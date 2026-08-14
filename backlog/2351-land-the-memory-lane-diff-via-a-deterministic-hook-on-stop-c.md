---
kind: story
size: 3
parent: "2301"
status: open
blockedBy: ["2350"]
dateOpened: "2026-07-09"
preparedDate: "2026-08-14"
tags: [agent-memory, lane, hook, self-improving-loop]
scope:
  - we:scripts/memory-land-at-stop.mjs
  - we:.claude/settings.json
  - we:scripts/__tests__/
  - we:skills-src/closing-session/SKILL.md
scopeRationale: "One new hook script, its registration as the repo's FIRST Stop hook in we:.claude/settings.json, its unit test, and a one-line pointer in the close skill so the close does not re-grow the memory-PR exception it deliberately removed."
---

# Land the memory-lane diff via a deterministic hook on Stop — no agent-run /pr

A deterministic **Stop** hook commits the dedicated memory-lane's `agent-memory-src` diff and hands it to
the standard transport (`we:scripts/pr-land.mjs --label-on-green` + the drain) — the agent never runs `/pr`
for memory. Blocked by #2350's supervised repoint: until the machine-global memory symlink resolves to the
reserved lane, this hook would be committing the PRIMARY checkout. Slice of #2301.

## Premise re-verified 2026-08-14 — corrections to the card's own prose

*(Independent review the same day re-verified every claim in this section against the files — all held —
and corrected two things the prep got wrong: the `Stop` event's cadence, and the concurrency primitive.
Both corrections are marked inline below.)*

The original card said this reuses "the close-session §1a survivors-ride-a-lane path". **That path no
longer exists.** `we:skills-src/closing-session/SKILL.md` now states, in as many words, *"The close never
opens a PR — no carve-out. The former memory-PR exception is gone"*, and *"Substantive agent-memory
content is NOT in this carve-out … the close no longer writes it at all"*. §1a today is
`we:scripts/conveyor/learnings-drop.mjs` — an untracked, machine-local JSONL append that touches no repo
content and opens nothing. So this item must **not** hook into the close; it must stand up its own
trigger. That is the fork below.

Also verified, and it is why nothing here is a no-op yet:

- **The repo has no `Stop` hook at all.** `we:.claude/settings.json` registers only `PreToolUse` (five
  Edit/Write hooks + one Bash) and `PostToolUse` (three). A repo-wide grep for `"Stop"` / `SessionEnd`
  across `we:scripts/`, `we:docs/`, `we:skills-src/` and `we:.claude/` returns nothing. This item adds the
  first one.
- **The reserved memory lane does not exist yet.** `we:scripts/lane-pool.mjs status --json` shows no lease
  carrying `reserved: true`, and the machine-global symlink still realpaths into the primary
  (`~/.claude/projects/-Users-…-webeverything/memory` → `we:.claude/agent-memory` → `we:agent-memory-src/`).
  #2350's agent-doable half (the `--reserve` primitive) landed; its human-gated cutover did not. The
  `blockedBy: ["2350"]` edge is therefore real, not bookkeeping.
- **#2352 already landed** (the guard's memory carve-out is gone, `b54f49a8`), so the guard side of #2301
  needs nothing from this item.

## Decided design

### Fork the card left open: which trigger — Stop, SessionEnd, loop-tick, or close-session? → **Stop, with its per-turn cadence designed for.**

**Harness fact this card had wrong until review, 2026-08-14.** `Stop` is **not** a session-terminal event.
It fires **after every assistant turn** — once per response, many times per session — and it **can block**
(exit 2 is a "keep going" instruction to the harness). The session-terminal event is **`SessionEnd`**,
which fires once, **cannot** block (its exit 2 is ignored), and runs under a **shared sub-second budget**
across all `SessionEnd` hooks, raised only up to a declared `timeout` (max 60 s). The card's earlier
ruling — *"Stop is the only harness event that fires for every session shape"* — was false on both halves:
`SessionEnd` exists and was never weighed, and `Stop` is per-turn, not per-session. Every ruling below is
re-argued on the corrected facts.

- **close-session is ruled out by an existing ruling, not by preference.** The close skill deliberately
  removed its memory-PR carve-out; re-adding memory landing there re-opens the exception that was closed.
  It is also a *skill* — agent judgment — and #2301's own constraint 3 is that the landing must be
  machinery. Same reason `we:scripts/drain-push-at-close.mjs` is a script the close *calls*, not prose the
  close *follows*.
- **loop-tick is ruled out by coverage.** It only fires under the conveyor. A solo session that writes a
  memory entry and stops would never land it, which is the majority case today.
- **`SessionEnd` is the closer fit for "once per session" and is still the weaker choice.** It never fires
  when the session is killed, crashes, or the host restarts — precisely the cases where an unlanded memory
  entry is most likely to be stranded — and its shared sub-second budget makes even the cheap local half
  (`git status` + a lock + a commit) a budget risk that has to be bought back with an explicit `timeout`.
- **`Stop` wins on the property that actually matters for a catch-up lander: the work is idempotent and
  near-free when there is nothing to do.** A clean memory tree costs one
  `git status --porcelain -- agent-memory-src` and exits; a dirty one lands promptly instead of waiting on
  a session end that may never arrive. Per-turn firing is a *feature* here — but a designed-for one, not a
  free one, so the three consequences below are requirements, not commentary.

*Consequences of the per-turn cadence — requirements, not caveats:*

1. **The hook sits on every turn's hot path.** The fast path is one
   `git status --porcelain -- agent-memory-src` against the resolved lane and nothing else — no lease
   read, no lock acquire, no `gh`, no `pr-land` — before any other work. Asserted, not assumed.
2. **A memory entry edited across several turns would otherwise open several PRs.** Debounce: no land
   while the newest `agent-memory-src` mtime is inside a quiet period (default 90 s), and no second land
   while this lane already has an open, unmerged memory PR.
3. **`Stop` can block the session.** This hook therefore exits **0 on every path** — landed, refused, and
   internal error alike. Fail-open is load-bearing here in a way it is not for a `PreToolUse` guard, where
   exit 2 is the intended deny.

*Residual, stated not hidden:* a session killed mid-turn leaves its memory commit for the next Stop to
pick up. At per-turn cadence that is usually the very next turn, and it is idempotent by construction (the
next Stop sees the same dirty tree and lands it) — strictly better than today, where nothing lands it.

### Where the memory lane is — derive it, never configure it

Resolve the lane from the symlink itself: `realpathSync(<memory symlink>)` yields
`<lane>/agent-memory-src`, so the lane root is its `dirname`. Authoritative by construction — whatever the
symlink points at is the tree that actually got written, so a config drift is impossible. Two refusals
before acting, both no-op-and-log rather than throw:

1. the resolved root is a constellation **primary** checkout (a mis-pointed or un-cut-over symlink — the
   #2350-not-done state) → refuse, loudly, and land nothing;
2. the lane's lease is not reserved (`isReservedLease`, `we:scripts/lib/lane-lease.mjs:58`) → refuse; a
   pooled lane's `refresh` would `reset --hard` the memory before the PR merged.

### Concurrency on a shared global tree

#2301 settled on **one machine-global** memory lane, so two sessions can Stop at once into the same
working tree. Serialise on the `O_EXCL`/`mkdir` lock primitive in `we:scripts/readiness/file-locks.mjs`
(`reserve` :237, `readLockEntry` :208, `releaseLockDir` :225) under **its own sentinel lock key** — a
`MEMORY_LAND_LOCK = '<memory:land-at-stop>'` declared in the new script, mirroring the
`NUMBERING_LOCK_PATH` / `DRAIN_LEASE_PATH` pair at `we:scripts/readiness/drain-lock.mjs:51-54` (*"distinct
strings ⇒ distinct lock dirs ⇒ the mutex and the lease never alias"*) — against the same machine-global
lock home `DRAIN_LOCK_ROOT` (`we:scripts/readiness/drain-lock.mjs:49`). Exactly one Stop wins; the loser
no-ops and the winner's commit already includes the loser's writes (same tree).

**Do NOT reuse `acquireDrainLease` — corrected on review, 2026-08-14.** An earlier draft of this card said
to take that lease "under its own `scope`". That does not serialise anything: `acquireDrainLease`
(`we:scripts/readiness/drain-lock.mjs:161`) hard-codes the single key `DRAIN_LEASE_PATH` — the **resident
drain daemon's whole-process lease** — and its `scope` argument is #2458 *advisory metadata written into
the lease payload*, not a lock namespace. Sharing that key means one of two live failures: the hook
silently never lands memory whenever a drain is mid-flight (the normal state — that lease being held is
exactly what `we:scripts/drain-push-at-close.mjs` no-ops on), or, winning it first, the hook blocks the
drain from starting for a full `DRAIN_LEASE_MINUTES` (15 min). A distinct key is the whole fix, and
`drainLeaseStatus` (:197) is likewise the wrong status read — it reads only the drain key.

### Not blocking the session

The Stop hook does only the cheap local half synchronously — is the tree dirty, take the lock, `git add
agent-memory-src && git commit` — then spawns `pr-land` **detached**, copying the proven shape at
`we:scripts/drain-push-at-close.mjs:94-119` (`detached: true` :116, fd-backed stdio, `.unref()` :119).
A Stop hook that awaited `--label-on-green` would hold the session open for the whole CI wait.

## Interfaces

- **New:** `we:scripts/memory-land-at-stop.mjs`, modelled on `we:scripts/drain-push-at-close.mjs`
  (165 lines) — a pure decision plus an injectable-boundary runner:
  - `export function decideMemoryLand({ laneRoot, lease, dirtyPaths, leaseStatus })` → `{ fire, reason }`
  - `export function buildPrLandArgs({ ref, bodyFile })` → the `pr-land` argv
  - `export function runMemoryLand({ spawnFn, nowMs, … })` — the impure edge, injected so the test
    asserts argv + `detached`/`unref` without a real PR
  - flags mirroring the sibling: `--dry-run`, `--json`
- **Reused as-is:** `we:scripts/pr-land.mjs` `--ref=… --label-on-green --body-file=…`. Note
  `prCreateBodyGuard` (`we:scripts/pr-land.mjs:346`) **refuses a bodyless PR**, so the hook must write a
  body file — a generated one-liner naming the session and the memory files touched.
- **Reused as-is:** `we:scripts/lib/lane-lease.mjs` — `isReservedLease` :58, `describeLease` :202.
- **Reused as-is:** `we:scripts/readiness/file-locks.mjs` — `reserve` :237, `readLockEntry` :208,
  `releaseLockDir` :225 — under a NEW sentinel key owned by this script (see *Concurrency*). The only
  thing borrowed from `we:scripts/readiness/drain-lock.mjs` is the shared lock home `DRAIN_LOCK_ROOT`
  (:49); none of its lease helpers apply.
- **Registration:** a new `"Stop"` array in `we:.claude/settings.json`'s `hooks` object, alongside the
  existing `PreToolUse` / `PostToolUse`. Expected payload (confirm against the running harness in task 1 —
  no other hook in this repo consumes it, so there is no local precedent to copy):
  `{ session_id, transcript_path, cwd, hook_event_name: "Stop", stop_reason, last_assistant_message }`.
  Fail-OPEN on any parse error — and here fail-open means **exit 0**, not exit 2: on `Stop`, exit 2 forces
  the session to keep going rather than denying anything.

## Ordered tasks

1. Confirm the Stop event payload **and its firing cadence** against the live harness (a throwaway hook
   that logs stdin and increments a counter — expect one fire per assistant turn, not one per session);
   record both in the script's header.
2. Write `we:scripts/memory-land-at-stop.mjs` — pure decision first (`decideMemoryLand`,
   `buildPrLandArgs`), then the injected-boundary runner. Clean-tree fast path before anything else.
3. Add the two refusals (primary-checkout target, non-reserved lease), the debounce (quiet period + open
   memory PR), and the serialisation on this script's own lock key.
4. Name the ref and keep the lane current: `--ref=lane/memory-<yyyy-mm-dd>-<short>` per land, and
   fast-forward the reserved lane to `origin/main` after a merge so the next Stop's diff is only the new
   memory change.
5. Unit-test in `we:scripts/__tests__/memory-land-at-stop.test.mjs`: clean tree → no-op with no lease
   read/lock/spawn; primary target → refuse; non-reserved lease → refuse; own lock held → no-op; **drain
   lease held → still lands** (proves the keys are distinct); inside the debounce → no-op; happy path →
   correct argv, `detached`, `unref`; every path exits 0.
6. Register the `Stop` hook in `we:.claude/settings.json`.
7. Add one line to `we:skills-src/closing-session/SKILL.md` pointing at the hook, so a future close does
   not re-grow the memory-PR exception on the grounds that "nothing lands memory".
8. Live check: write a memory entry, let a turn end, confirm ONE `ready-to-merge` PR appears (not one per
   subsequent turn) and the primary checkout stays clean.

## Delivery shape

**One piece.** The script is meaningless without its `Stop` registration and the registration is unsafe
without the script's two refusals, so a slice would land a half-armed hook. It is also small — one new
file in the shape of an existing 165-line sibling, one settings entry, one test file. It stays behind
#2350's supervised cutover; landing it first would point the committer at the primary tree.

## Size — 3 (unchanged)

Basis: one new script that is a near-clone of an existing 165-line sibling
(`we:scripts/drain-push-at-close.mjs` — same pure-decision + injected-spawn shape, same detach mechanics,
same lock primitive), one `we:.claude/settings.json` entry, one test file. No new primitive is invented —
the new lock key is a new *string*, not a new mechanism. The things that keep it off a 2: this is the
repo's **first** `Stop` hook, so the event payload is unverified surface; the shared-tree race needs its
own lock key; and the per-turn cadence adds a debounce plus a clean-tree fast path that both need
asserting. Still a 3 — none of those changes the shape of the file.

## Done when

- With the memory symlink resolved to the reserved lane, writing a memory entry and ending a turn produces
  **one** open PR labelled `ready-to-merge` whose diff is exactly the `agent-memory-src` change — with
  no agent-run `/pr` and no agent decision in the loop. Subsequent turns in the same session open no
  further PRs.
- `git status --porcelain` in the primary checkout is empty across that whole round-trip.
- A Stop with a clean memory lane exits 0 and spawns nothing (asserted in the unit test and observable in
  `--dry-run --json`), and does so having read **no** lease and taken **no** lock — asserted by call
  counts on the injected boundaries, since this runs on every turn.
- A Stop lands memory **while the resident drain holds its own `DRAIN_LEASE_PATH` lease** — the unit test
  holds that lease and asserts the memory land still fires, proving the two lock keys do not alias.
- The hook exits **0 on every path** — landed, refused, debounced, and internal error — because a `Stop`
  exit 2 would force the session to continue rather than deny anything.
- With the symlink still pointing at a **primary** checkout, the hook refuses, logs the reason, commits
  nothing and opens nothing (unit-tested).
- With the target lane's lease **not** `reserved`, the hook refuses and opens nothing (unit-tested).
- Two Stops racing on the same memory lane produce **one** commit and **one** PR; the loser no-ops
  (asserted against a held `drain-lock` lease).
- The Stop hook returns without waiting on CI — the test asserts the spawned child carries
  `detached: true` and is `unref`'d, matching `we:scripts/drain-push-at-close.mjs`.
- A malformed or unrecognised Stop payload fails **open**: exit 0, nothing spawned, session unaffected.
- `we:skills-src/closing-session/SKILL.md` names the hook as what lands memory, and still says the close
  itself opens no PR.
