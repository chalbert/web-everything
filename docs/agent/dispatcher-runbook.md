# Operating the mechanical dispatcher (epic #3383)

The dispatcher is a **headless runner** (`we:skills-src/conveyor/runner.mjs`) that steps the mechanized tick
core with no model context and surfaces dispatch/watch decisions for a judgment layer to act on
(`we:skills-src/conveyor/SKILL.md` §2 is that judgment layer's own operating script — read this file first if
you're operating it cold, not building it). This file is the reference for someone who did **not** build it:
how to tell it's alive, how to stop it safely, how to close out a stuck dispatched agent, what env vars a real
dispatch needs, and where its state and logs live. Sourced from the operational knowledge already recorded
across epic #3383's own session updates — see that card for the full incident-by-incident history.

**Landing-order note.** `we:skills-src/conveyor/supervisor.mjs` — the resident process meant to keep the runner
itself alive across a crash (restart, backoff, its own JSONL log) — exists only on `origin/lane/mechanical-
dispatcher`, not `main`, as of this writing. Nothing installs it to `launchd` yet either. Everything below
covers what's actually landed: the runner itself, and the dispatched delivery agents it spawns. Once the
supervisor graduates to `main` (tracked by #3443), this file needs a section for it (its own liveness check, its
own restart/backoff behavior, its own log) — check #3383 for that graduation's status before assuming the
supervisor exists.

## Is the runner alive?

The runner holds a machine-global singleton lease while it's driving — a second launch checks the SAME lease,
so the same read tells you whether one is running. There's no CLI flag for this yet; read the lease directly:

```bash
node -e "import('./skills-src/conveyor/runner-lock.mjs').then(m => console.log(m.runnerLeaseStatus()))"
```

Returns `{ held, stale, owner, heartbeatAt }`:
- `held: true` — a live runner is driving (heartbeat within the last 15 min — its lease TTL, well past the
  runner's own ~120s tick interval).
- `held: false, stale: true` — a lease exists but its holder crashed; reclaimable by the next launch.
- `held: false, stale: false` — no runner has run recently.

`owner` is `<hostname>:<pid>:conveyor-runner` — cross-check the pid with `ps -p <pid>` if you want OS-level
confirmation, not just the lease record. The lease lives at `~/.claude/conveyor-runner-locks/` (machine-global,
not per-checkout — a runner launched from any clone contends on the same lease).

## Stopping the runner safely

The runner is a plain background Node process, not a `claude` session — `claude agents`/`claude stop` don't see
it (those apply to dispatched delivery **agents**, next section). It has no supervisor yet, so nothing restarts
it after any kind of stop:

- **Preferred: let it idle-stop itself.** The runner stops its own loop (and releases its lease) once the queue
  is empty and there's been no operator feedback for ~15 min. No action needed.
- **To end it now:** stop whatever process is hosting it — `TaskStop` if it was launched as a backgrounded tool
  call from an interactive session, or a plain process signal/Ctrl-C if launched by hand. The runner's lease
  release lives in a `finally` around its drive loop, so a clean exit releases it immediately; a hard kill
  leaves a stale lease that reclaims itself via the 15-minute TTL on the next launch — either way a fresh
  `/conveyor` restart is safe, it just may wait out the TTL first.

## Closing out a stuck `--bg` dispatched agent

This is about a **delivery agent** the runner spawned (`claude --bg`), not the runner itself.

1. **Check it first:** `claude agents --json` — look for the stuck session's row. A row with no live `pid` in
   the listing is stale bookkeeping, not a live process (seen repeatedly during #3383's own testing) — nothing
   to kill.
2. **Never `kill <pid>`.** It ends the OS process but does not deregister the session — something resurrects it
   under a new pid minutes later, which has raced a legitimate second dispatch onto the same lane and produced
   a real double-dispatch (#3383, 2026-08-31 session).
3. **Use `claude stop <id>`** instead — it deregisters the session for real; every stop issued through it has
   stayed stopped.
4. **Mechanized composition:** `we:scripts/operations/dispatch-abort.mjs` shells the safe sequence —
   ```bash
   node scripts/operations/dispatch-abort.mjs --abort=<runId> --key=<effectKey> [--status=failed] [--note="..."] [--force]
   ```
   Stops the session via `claude stop`, then closes out the run record so `we:scripts/operations/wake.mjs`'s
   liveness check passes on its own merits, without needing `--force`. Use `--force` only when you already know
   by other means the agent is gone (e.g. `claude agents --json` itself is unreadable) — it skips the liveness
   check.
5. **A genuinely fresh scratch clone needs trust before a dispatch into it will work.**
   `we:scripts/bootstrap-session.mjs`'s `trustableDirs()` only ever trusts the primary checkout and lane-pool
   lanes, never an ad-hoc scratch clone — a dispatched agent spawned into an untrusted one stalls on a
   permission-prompt dialog with nobody there to answer it. Grant trust first:
   ```bash
   node scripts/operations/dispatch-abort.mjs --trust=<path-to-scratch-clone>
   ```
6. `dispatch-abort.mjs` deliberately does **not** release a lane the aborted dispatch may have partially
   acquired — that's a separate judgment call (was the tree actually clean?). Release it by hand once you've
   checked: `node scripts/lane-pool.mjs release --lane=<n> --force`.

## Env vars a real dispatch needs

- **`WE_DISPATCH_AGENT_ARGS`** — a JSON array of extra `claude` flags passed to every dispatched agent (e.g.
  `'["--permission-mode","dontAsk"]'`). Unset ⇒ `[]` (no extra flags, not an error) — but a `--bg` dispatch
  with no permission mode set risks stalling on a prompt nobody can answer, so set it explicitly for a real
  run. A malformed value (not a JSON array of strings) throws rather than silently dispatching without it.
- **The permission mode that actually works for `--bg`, confirmed the hard way (#3383, 2026-08-31 session):
  `dontAsk`.** `acceptEdits` works fine for a foreground (`claude -p`) dispatch but stalls every time under
  `claude --bg` specifically — the two modes are not interchangeable across foreground/background, contrary to
  earlier assumptions. `bypassPermissions` is not viable either (`--dangerously-skip-permissions` requires a
  real TTY to accept its one-time disclaimer; cannot be scripted). So the working invocation is:
  ```bash
  WE_DISPATCH_AGENT_ARGS='["--permission-mode","dontAsk"]' node skills-src/conveyor/runner.mjs --json
  ```
- **A fresh scratch clone must be trusted before it's dispatched into** — see step 5 above. This isn't an env
  var, but it's the other precondition that silently stalls a `--bg` dispatch the same way a missing
  permission mode does, so check both together before a real run.

## Where logs and state live

Everything below is machine-local and gitignored — none of it lands on `main`.

| What | Where |
|---|---|
| Runner singleton lease (liveness/ownership) | `~/.claude/conveyor-runner-locks/` |
| Per-dispatch operation run records | `<checkout>/.operations/runs/<id>.json` |
| Learnings drop-box (per-session, pre-harvest) | `~/.claude/conveyor/learnings/<session>.jsonl` (override: `$LEARNINGS_POOL`, or `$LEARNINGS_DROPBOX` for the exact file) |
| Session-local conveyor queue (operator's "clear this for build") | `<checkout>/.conveyor/queue.json` |
| Infra-blocked recovery state | `<checkout>/.conveyor/infra-blocked.json` |
| The runner's own per-tick output | its stdout (`--json` for one line per tick) — no fixed log **file** yet; that's the supervisor's job once it lands (see the landing-order note above) |

`claude agents --json` is the liveness read for dispatched delivery agents (not the runner itself — see
above). It can report stale rows for sessions that no longer exist; a row missing `pid` is exactly that, not a
live process to chase down.

## Discoverability

Linked from `we:skills-src/conveyor/SKILL.md` §2 ("Start the runner") — that's where an operator running the
dispatcher will naturally land first.
