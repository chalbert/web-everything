---
bornAs: x6einv9
kind: decision
parent: "3383"
status: open
dateOpened: "2026-09-14"
preparedDate: "2026-09-23"
preparedAgainstSha: "fcc756b2c1d35229a1e95750de02a99bfa4820a5"
relatedTo: ["3625", "3467", "3397", "3756", "2501", "3443", "3649"]
relatedReport: reports/2026-09-23-daemon-lifecycle-staleness-reload-prep.md
tags: [daemons, ops, staleness, live-reload, decision-prep]
---

# Mechanize long-running daemon lifecycle: health-check, staleness detection, and live-reload

**Digest.** Every resident daemon should record the commit(s) it booted from and the files it actually loaded,
check at its own safe point whether any of those files changed, and if so exit cleanly so its relauncher brings
it back on the new code — the reload the drain daemon already has ratified (#2501,
[#drain-daemon-self-hosting-boundary](/docs/agent/platform-decisions/#drain-daemon-self-hosting-boundary) clause 2),
extended to all of them. Drift against *origin* is detected read-only and reported; a daemon only updates its own
checkout where a per-daemon opt-in's four safety conditions hold. True in-place hot-reload is ruled out: Node
cannot unload modules, and the in-flight work the operator feared losing (dispatched agents, leases, the drain
queue) already lives outside the process.

*Prepared 2026-09-23 (session prep-3681). Research topic:
[/research/resident-daemon-staleness-and-reload/](/research/resident-daemon-staleness-and-reload/). Session report:
`we:reports/2026-09-23-daemon-lifecycle-staleness-reload-prep.md`. Cites read on `origin/main` `e43f2b12d`; "(proto)"
marks a fact that exists only on `origin/lane/mechanical-dispatcher` `600acc14f`. One Opus skeptic round and one
fresh-context screen ran; the body is the version that survived them (Fork 4 flipped, Fork 3 dissolved, Forks 1–2
amended).*

## The ask (operator, epic #3383, 2026-09-14)

Mechanize how the system manages its own long-running daemons instead of each session finding staleness by ad
hoc investigation. Three linked asks: (1) start/stop/restart/health-check tooling; (2) automatic detection that a
daemon's running code is stale against its branch's HEAD; (3) a reload path that does not lose in-flight
agent/command state — *"if it can reload and reconnect agent and command it could work"*.

**Motivating evidence — the same failure twice in one night (2026-09-14).** (1) The telemetry fix (PR #2198)
needed a manual restart of the resident runner; nothing noticed the process predated the fix. (2) The dispatch
fix `14e0a7249` (a 33-hour silent dispatch block) landed on the driver's own branch, and the live driver (PID
93017) kept running the old code until someone thought to check. Both times the fix was fine; the system just
did not know a running daemon no longer matched its code. Earlier: #3467 records three hand restarts of the
runner on 2026-09-03 for the same reason.

## FOUND (grounding)

- **Nothing records the commit a daemon booted from, and nothing compares it to HEAD.** No boot-sha field on
  either branch. The driver-mode marker is `{mode, startedAt, pid, maxTicks}`. The lease entry
  (`we:skills-src/conveyor/runner-lock.mjs:108-113`) exposes `{held, stale, owner, heartbeatAt}` — no revision.
  The drain daemon uses a different lock (WE's `drain-lock`) with its own schema.
- **The existing "stale" checks are about other things.** `assertMainNotStale`
  (`we:scripts/lib/main-staleness.mjs:141`) fast-forwards a *checkout*, never the code already imported. The (proto)
  main-ref-sync pass moves a *ref*. The driver-watchdog's `stale` verdict means "no progress for 20 min"
  (liveness); its last-known-good marker is a rollback target, and "whoever promotes the driver onto new code runs
  `record-good` FIRST" (`we:scripts/conveyor/driver-watchdog.mjs:48-55`).
- **Which daemons freeze code at boot.** Frozen: the runner and supervisor, `review-daemon`
  (imports its passes in-process, `we:skills-src/conveyor/review-daemon.mjs:49-53`), `reconcile-fix-dispatch-daemon`,
  `verify-daemon`, the `pass-daemon` shell, and the drain daemon (`plateau:tools/drain-daemon/daemon.mjs`, up ~22 days
  on 2026-09-23). Not frozen: every pass child the runner, `pass-daemon` and the drain daemon spawn per run.
- **Not every loaded file is a static import.** The runner lazy-loads the hiccup modules with `await import`
  (`we:skills-src/conveyor/runner.mjs:369-370`). The drain daemon loads WE's drain lock
  (`we:scripts/readiness/drain-lock.mjs`) by dynamic import from a *different repo's* clone
  (`plateau:tools/drain-daemon/daemon.mjs:176-183`) — a clone it hard-resets every pass, so the file on disk changes
  under the frozen module.
- **In-flight state is already out of process.** Agents start with `claude --bg` and are tracked through
  `claude agents`; (proto) spawned `detached` + `unref()` (`we:scripts/operations/detached-dispatch.mjs:96-110`
  (proto)). (proto) runner bookkeeping is persisted to disk. Drain state is GitHub. Leases are files
  (`we:skills-src/conveyor/runner-lock.mjs:51`).
- **Operator state is found by script location.** The queue root is derived from where the script sits, not
  the working directory (`we:scripts/conveyor/queue-store.mjs:124-130`), and the operator queues from the
  primary checkout — [#state-lives-where-its-nature-dictates](/docs/agent/platform-decisions/#state-lives-where-its-nature-dictates)
  clause 1 names that primary-writable queue as its type case. A daemon moved to another checkout would read a
  different `.conveyor/`.
- **Known restart loss windows (build gaps, not forks).** Runner on main has no SIGTERM handler, so its lease leaks
  for the 15-min TTL (fixed (proto) `we:skills-src/conveyor/runner.mjs:1276-1300`). A build agent spawned < 60 s
  ago may be unlisted — (proto) `restart-runner` refuses in that window. `we:skills-src/conveyor/pass-daemon.mjs:148-155`
  exits without killing its in-flight child. Review dispatch has no durable claim, only a lagging liveness read.
- **Relaunch machinery, and its gaps.** The supervisor classifies child exits and relaunches (`classifyExit`
  `we:skills-src/conveyor/supervisor.mjs:94-101`, `decideRestart` `:120`) — but `classifyExit` has no `reload` reason
  and treats any exit under 3 s (`:52`) as a crash before it reads `stoppedReason`. launchd `KeepAlive` relaunches
  review / fix-dispatch / pass daemons and the drain daemon; **nothing relaunches the conveyor supervisor or the
  manifest launcher** (no plist installed; `we:skills-src/conveyor/com.we.conveyor-supervisor.plist.example` is
  inert). The launcher already treats `DAEMON_MANIFEST` as the list of "every resident conveyor daemon"
  (`we:skills-src/conveyor/supervisor-launcher.mjs:4-7`). (proto) `restart-runner` is a declared safe-restart
  operation. `runner-activity` covers only three daemons.
- **Checkouts.** review / fix / pass daemons run from a dedicated `wev-review-daemon` checkout that something
  outside the repo merges `origin/main` into, followed by a manual restart 4 s later (reflog). The live driver runs
  from the primary checkout (detached HEAD, 26 behind). The drain daemon runs from plateau-app primary — the
  ratified #2501 dedicated clone is unbuilt.
- **Merge rate.** Main took ~43 first-parent merges a day over 2026-09-16..23, and
  [#poc-branch-mechanical-sync](/docs/agent/platform-decisions/#poc-branch-mechanical-sync) merges each into the POC
  branch too. `review-daemon`'s import closure (83 files) was touched by ~9% of those commits.
- **Statute precedent.** [#drain-daemon-self-hosting-boundary](/docs/agent/platform-decisions/#drain-daemon-self-hosting-boundary)
  (#2501) rules, for the drain daemon only: a dedicated clone it resets itself, justified *because* it self-updates
  (clause 1); reload by clean exit + `KeepAlive` between passes (clause 2); independent review of self-source changes
  (clause 3), which the #3649 rider already extends to driver-class processes.

**Prior art** (full survey in the research topic). Every production system except Erlang/OTP reloads by *stop at
a safe point → supervisor relaunches fresh code*, with state outside the process: systemd/launchd, Kubernetes
rolling updates (`preStop` + grace period), nginx/Unicorn re-exec, pm2 `reload`. Node's own `--watch` restarts;
it does not hot-swap. Staleness is detected by the process *publishing the revision it runs* (Prometheus
`build_info{revision}`) and comparing it with the *desired* revision (Argo CD / Flux "OutOfSync") — and Argo CD
*detects* drift by default, while auto-sync is a per-application opt-in.

## Axis framing

Three separate questions: **how** a daemon picks up new code (reload primitive, Fork 1), **what** counts as
stale (Fork 2), and **who moves the checkout** the daemon runs from (Fork 4). The drain-daemon statute answered
the first and third for one daemon; this item generalizes the first, adds the second, and narrows the third —
clause 1's self-update was justified by the drain's own conditions, which most daemons do not meet. When to run
the check, lifecycle tooling and per-daemon scope are not forks (see Supported by default).

## Recommended path at a glance

| Fork | Recommended default | Main alternative (excluded) | Confidence |
|---|---|---|---|
| Fork 1 — reload primitive | **(b) exit cleanly at a safe point; an outside relauncher brings it back** (extend #2501 clause 2) | (a) in-place hot-reload | high — precedent + platform limit |
| Fork 2 — what counts as stale | **(b) a file the daemon actually loaded changed since boot (runtime-recorded, per repo), with an age backstop** | (a) any new commit on the checkout | med-high |
| ~~Fork 3 — what triggers the check~~ | dissolved → Supported by default (poll at the safe point) | — | — |
| Fork 4 — who moves the daemon's checkout | **(a) nobody automatically: detect origin drift read-only and report; self-update is a per-daemon opt-in, off by default, only where four safety conditions hold** | (b) self-update on for every daemon, gate stripped | med-high |

## Supported by default (not forks)

- **Check at the safe point (was Fork 3, dissolved by the screen).** Fork 1 only acts at the safe point, so a file
  watcher's earlier notice buys nothing; the two are behaviourally identical to the operator. Builder default: run
  the Fork 2 check at each loop iteration before the next pass. Acceptance bar: a reload happens within one loop
  interval of the change reaching the checkout, and no resident file-watch handle is added.
- **One mechanism for every daemon, per-daemon parameters (the original "uniform vs tiered" fork, dissolved).** The
  mechanism (boot record, closure check, clean exit, relaunch) is the same; what differs is data — entry, safe
  point, checkout, tracked branch, relauncher, and whether self-update is allowed (Fork 4). Blast radius is handled
  by the review invariant, not by a different reload mechanism: *reloading onto code already in the checkout the
  operator runs* opens no review hole; *pulling* new code in does, which is exactly what Fork 4 gates.
- **One source of truth for the daemon list: extend `DAEMON_MANIFEST`, not a second registry.** The manifest
  launcher already treats it as the list of every resident conveyor daemon. Add the lifecycle fields (entry,
  checkout, tracked branch, relauncher, safe-point kind, `selfUpdate`) there. The plateau-app drain daemon is listed
  as a read-only external entry for status; its lifecycle stays with its own CLI per #2501. `runner-activity` reads
  this list to cover every daemon, not three.
- **A declared `daemon` status/restart operation (ask 1)** generalizing the (proto) `restart-runner` refusals
  (just-spawned-agent window, evidence-confirmed shutdown, leaked-lease sweep). `daemon restart <name>` (or SIGHUP)
  means "reload at your next safe point", never an immediate kill. A `daemon promote <name>` step is the one
  sanctioned way to move a non-self-updating daemon's checkout: run `record-good` first, then fast-forward, then the
  daemon reloads on its own.
- **Publish the running revision in the daemon's heartbeat record** — the runner-lock lease entry, or the
  drain-lock entry for the drain — as `bootShas` (per repo) and `closureDigest`. Observers *report* drift ("running
  `abc123`, checkout at `def456`, origin at `9f0e11`"); the daemon itself *acts*.
- **The driver-watchdog is related, not the same mechanism.** It watches liveness; this watches code revision.
  Under Fork 4 (a) a daemon never moves its own checkout, so a watchdog rollback (`reset --hard <last-known-good>`)
  is respected by construction — and the reload then puts the daemon on the known-good code.
- **Restart-storm guard (needed — the draft's "no new guard" was wrong).** (1) A `reload` exit is its own clean
  reason in `classifyExit`, exempt from the 3 s `too-short` rule and from crash backoff. (2) A daemon that reloads
  twice onto the same boot sha, or reloads and then crash-loops, stops reloading and alerts. (3) launchd-hosted
  daemons get no backoff beyond launchd's ~10 s throttle and have no last-known-good — so for them the alert is the
  guard.
- **Build prerequisites (gaps to close first, not choices):** runner SIGTERM handler on main (lands with #3443);
  `pass-daemon` kills its in-flight child on SIGTERM; review dispatch gets a durable claim like fix dispatch's
  `action-store`; an outside relauncher for the conveyor supervisor (Fork 1); build #2501 clauses 1–2 for the drain.

## Fork 1 — reload primitive: how a daemon picks up new code

*Fork-existence:* real either/or with a broken branch — (a) cannot be built correctly on Node (no module unload),
and #2501 clause 2 already rejected exec-in-place for the same daemon class.

- **(a) In-place hot-reload.** Re-import changed modules into the running process (cache-busting dynamic import)
  and swap handlers without exiting. *Pro:* no process gap. *Con:* Node ESM never frees a loaded module, so every
  reload leaks a full module graph; timers, listeners and closures from the old graph keep running old code;
  module-level singletons (the lease handle, heartbeat timer) duplicate. Doing it safely means Erlang-style
  explicit state migration per module — a runtime Node does not have.
- **(b) Exit cleanly at a safe point; an outside relauncher brings it back (default).** At the daemon's safe point
  (between passes / ticks), release the lease, exit with a distinct `reload` reason, and let launchd `KeepAlive` or
  the conveyor supervisor (`we:skills-src/conveyor/supervisor.mjs`) relaunch it on the new code. *Pro:* exactly
  #2501 clause 2; the "in-flight agent/command state" survives because it is already out of process (detached
  agents, file leases, GitHub). *Con:* a few seconds' gap per reload; needs the build prerequisites above.
  **Two amendments from the skeptic:** (1) `classifyExit` gains a `reload` clean reason, checked *before* the
  `too-short` rule, so a reload on the first tick after boot is not counted as a crash. (2) A daemon with no outside
  relauncher — today the conveyor supervisor and the manifest launcher — first gets one (install its launchd
  `KeepAlive` agent from the existing plist example). Its safe point is: SIGTERM the child → wait for the child's
  clean exit → exit itself.

**Default: (b).** It delivers what the operator asked for — "reconnect agent and command" — because nothing needs
reconnecting: the new process reads the same leases, bookkeeping and `claude agents` listing the old one did.

```js
// Fork 1 (b) — in every resident daemon's loop, at its safe point (between passes).
import { releaseRunnerLeaseIfOwned, RUNNER_LOCK_ROOT } from './runner-lock.mjs';

if (codeIsStale()) {                                   // Fork 2
  log({ event: 'reload', reason: 'code-stale', bootShas, headShas });
  releaseRunnerLeaseIfOwned(RUNNER_LOCK_ROOT, owner, { key });
  announceStop('reload');                              // read back as stoppedReason by the supervisor
  process.exitCode = 0;
  return;                                              // leave the loop; launchd KeepAlive / supervisor relaunches
}

// supervisor classifyExit — the reload reason is checked before the too-short crash rule:
if (code === 0 && stoppedReason === 'reload') return { kind: 'clean', reason: 'reload' };
if (ranMs < crashThresholdMs) return { kind: 'crash', reason: 'too-short' };
```

Skeptic: SURVIVES-WITH-AMENDMENT — hot-reload's exclusion held; the attack found `classifyExit` would misread an
early reload as a crash and that nothing relaunches the supervisor; both folded in as amendments (1) and (2).
Screen: clear — reload semantics set the no-lost-work guarantee the operator relies on; (a) is impossible on Node
at any build cost, not a scheduling call.

## Fork 2 — what counts as stale

*Fork-existence:* real either/or — (a) is flawed: at ~43 merges a day (FOUND) it bounces every frozen daemon about
40 times a day even when none of its code changed, and each bounce opens the restart loss windows in FOUND for no
benefit. One trigger rule has to be the default.

- **(a) Any new commit.** Stale when the checkout's HEAD ≠ the boot sha. *Pro:* trivial; never misses a change.
  *Con:* ~10× the restarts of (b) (the review-daemon's closure was touched by ~9% of commits); each restart risks
  the just-spawned-agent window and the review claim race; pass children already get fresh code without a restart.
- **(b) A file the daemon actually loaded changed (default).** At boot, record the boot sha of **every repo** the
  process loads code from, and — via a Node module-loader hook (`module.register` with a `resolve` hook that logs
  each `file://` URL) — the set of (repo, path) pairs it actually loaded, including lazy and cross-repo dynamic
  imports. Stale when `git diff --name-only <bootSha> HEAD` in any of those repos touches a recorded path. **Age
  backstop:** also stale when any boot sha is more than 24 h or 200 commits behind, so a missed file (e.g. a data
  file read with `fs`, not `import`) cannot leave a daemon stale indefinitely. *Pro:* restarts only when it matters;
  catches the runner's lazy hiccup imports and the drain's cross-repo drain-lock load. *Con:* the loader hook is
  a new piece of boot code every daemon must load first.

**Default: (b).** Matches the GitOps pattern (compare the *relevant* live revision with the desired one), keeps
restarts rare, and the backstop bounds the one failure mode (a file the hook cannot see).

```js
// Fork 2 (b) — boot: record what was actually loaded (runs before the daemon's own imports).
import { register } from 'node:module';
register('./record-loaded.mjs', import.meta.url);      // resolve hook appends each file:// URL to a shared list

// safe point: compare per repo, with the age backstop.
function codeIsStale() {
  for (const { repo, checkout, bootSha, paths } of loadedByRepo()) {   // grouped from the hook's list
    const head = git(['rev-parse', 'HEAD'], { cwd: checkout });
    if (head === bootSha) continue;
    const changed = git(['diff', '--name-only', bootSha, head], { cwd: checkout }).split('\n');
    if (changed.some((f) => paths.has(f))) return true;
    if (commitsBetween(checkout, bootSha, head) > 200 || ageHours(checkout, bootSha) > 24) return true;
  }
  return false;
}
```

Skeptic: SURVIVES-WITH-AMENDMENT — the merit held (measured ~10× fewer restarts than (a)); the attack showed a
*static* import closure misses the runner's lazy imports and the drain's cross-repo dynamic import and that "the
next natural restart" is no bound (22-day uptime); fixed by the runtime loader hook, per-repo boot shas and the
age backstop.
Screen: clear (re-screened after the amendment) — sets restart frequency, a behaviour the operator sees; (a)'s churn
is inherent, not an effort cost.

## Fork 4 — who moves the checkout a daemon runs from (self-update: gated and off by default, or on everywhere)

*Fork-existence:* real either/or with a broken branch — (b) is broken on three independent counts at any build
cost: it splits the daemon from the operator's state, it undoes the watchdog's rollback, and it runs unreviewed
POC-branch code in a process that dispatches agents and pushes (details under (b)). One of the two must be the
default for a daemon that has not opted in.

- **(a) Detect-only by default; self-update is a per-daemon opt-in under four conditions (default).** Every daemon
  runs a read-only `git fetch` of its tracked branch at the safe point and publishes "origin is N commits ahead,
  and M of them touch my loaded files" in its heartbeat record; `runner-activity` / `daemon status` show it and the
  runner-down alert (#3756) can surface it. The daemon never writes its own checkout; moving it is `daemon promote`
  (runs `record-good`, fast-forwards, the daemon then reloads via Forks 1–2). A daemon may instead set
  `selfUpdate: true` in its manifest entry **only when all four hold:** (i) its tracked branch is review-gated —
  never a POC branch — or independent review is proven before the reload (#2501 clause 3 and the #3649 rider);
  (ii) all operator state it reads (`.conveyor/*`) lives at a fixed state root outside the clone, passed by flag or
  env, never found by script location; (iii) a watchdog last-known-good pin blocks the fast-forward until cleared,
  and every self-update runs `record-good` first; (iv) `git clean` excludes the state directory. The drain daemon,
  once #2501 clause 1 is built, meets all four (tracks `main`, state on GitHub). *Pro:* detection covers both
  incident shapes; nothing silently pulls code; composes with every statute below. *Con:* for a non-opted daemon,
  origin drift is *reported*, not auto-applied — someone (or a later mechanical promoter) runs `promote`.
- **(b) Self-update on for every daemon, with the gate stripped** — every daemon runs from its own dedicated clone and
  fast-forwards it at the safe point, with none of (a)'s four conditions. This is the same `selfUpdate` knob as (a),
  set on everywhere with its safety gate removed, not a separate architecture. *Pro:* fully hands-off. *Con — broken:* (1) a runner in its own clone reads *its own* queue, dispatch-pause and queue-scope
  files under `.conveyor/`, so the operator's queue and pause from the primary are silently ignored (FOUND; collides
  with #state-lives-where-its-nature-dictates clause 1); (2) the next safe point fast-forwards straight past a
  watchdog rollback, re-applying the bad code in a loop, and never runs `record-good`, so the watchdog then refuses
  to heal; (3) the runner tracks the POC branch, where landing skips review
  ([#poc-branch-declared-delivery-mode](/docs/agent/platform-decisions/#poc-branch-declared-delivery-mode) clause 2),
  so it would self-apply unreviewed code — the #809 self-approval hole #2501 clause 3 closes; (4) after graduation,
  `git clean -fdq` on main deletes `.conveyor/` state files main does not ignore.

**Default: (a).** Mirrors the GitOps split (Argo CD detects drift by default; auto-sync is a per-app opt-in) and
keeps #2501 clause 1's self-update where its own justification holds, instead of stretching it to daemons that
only need to detect.

```js
// Fork 4 (a) — at the safe point, read-only. `entry` is the DAEMON_MANIFEST row.
git(['fetch', '--quiet', 'origin', entry.trackedBranch], { cwd: entry.checkout });   // updates refs only
const ahead = git(['rev-list', '--count', `HEAD..origin/${entry.trackedBranch}`], { cwd: entry.checkout });
publishHeartbeat({ originAhead: Number(ahead), originTouchesLoaded: touchesLoaded(`origin/${entry.trackedBranch}`) });
if (entry.selfUpdate) selfFastForward(entry);          // only entries that meet conditions (i)–(iv)
```

Skeptic: REFUTED the draft default (every daemon self-updates its own clone) — state split from the primary queue,
watchdog-rollback loop, unreviewed POC code, `git clean` data loss, and a circular citation of #2501 clause 1 (its
forced invariant presumes self-update, so it cannot be cited to *choose* self-update). Default flipped to (a), with
the skeptic's four conditions as the opt-in gate.
Screen: clear (re-screened after the flip) — decides whether a daemon can silently run unreviewed code and whether
it sees the operator's queue; (b)'s breaks are outcome defects, not effort costs. Config-dimension check: the
`selfUpdate` knob is real, but (b) is that knob with its gate removed — an illegitimate value, not a second
legitimate setting — so the either/or holds; relabelled (b) accordingly.

## Statute note (for `codifiedIn` at resolve)

**Mint a new anchor** (working name `#resident-daemon-reload-lifecycle`), not an amendment of
#drain-daemon-self-hosting-boundary: that anchor's clause 1 is justified by self-update and does not transfer to
detect-only daemons. The new anchor states Forks 1, 2 and 4 for every resident daemon and cites #2501 for the
drain-specific clauses. How it composes with existing statute:

- **#drain-daemon-self-hosting-boundary** — the drain is the first `selfUpdate: true` daemon; its clauses 1–2 are the
  worked instance. Clause 3's independence invariant is carried across as Fork 4 condition (i), not kept drain-only
  (the #3649 rider already extends it to driver-class processes).
- **#state-lives-where-its-nature-dictates** — Fork 4 condition (ii): operator state stays primary-writable; a daemon
  clone points at it, never copies it.
- **#poc-branch-declared-delivery-mode** — a POC-tracking daemon cannot self-update (condition (i)).
- **#poc-branch-mechanical-sync** — supports Fork 2 (b): every landing on main is merged into the POC branch too, so
  "any commit" would multiply restarts on both.
- **#primary-read-only-lanes-only** — no conflict: it limits *writes* to the primary; a detect-only daemon executing
  from the primary writes nothing to its tree.
- **Driver-watchdog last-known-good** (proto, not yet statute) — Fork 4 condition (iii).

## Follow-on build (on ratification)

The existing open build cards become this ruling's slices, re-scoped rather than duplicated: #3467 (runner restart
on main) and #3397 (supervisor reload lifecycle, blocked by #3443) implement Forks 1–2 for the runner/supervisor;
#3756's runner-down alert reads the extended manifest and the origin-drift field. New slices: manifest lifecycle
fields + `runner-activity` coverage; the loader hook + boot record in the heartbeat; `classifyExit` `reload` reason
+ the reload-loop guard; the supervisor's launchd relauncher; the `daemon status/restart/promote` operation;
`pass-daemon` child-kill on SIGTERM; a durable review claim; the drain daemon's #2501 clause 1–2 build. Predicted
touch-set: `we:skills-src/conveyor/`, `we:scripts/operations/runner-activity.mjs`, `we:scripts/operations/runner-activity-io.mjs`,
`we:scripts/operations/restart-runner.mjs` (proto), `we:scripts/conveyor/driver-watchdog.mjs`, `plateau:tools/drain-daemon/`.

### Review jury (provisional — pre-registered #2638)

Care level: `elevated`. This jury binds against the item's predicted scope and is re-checked against the real diff at PR open.

| juror | lens | grounding method | pre-registered expectation |
| --- | --- | --- | --- |
| correctness#1 | correctness | static-review | The change does what the spec says with no behaviour regression — every changed branch is exercised, and no test is missing, weakened, or gamed to pass while the behaviour is wrong. |
| security#1 | security | static-review | No untrusted input, secret, auth, or file/network path is left unguarded and the trust boundary is not widened — anything touching those earns an explicit security check. |
| simplicity#1 | simplicity | static-review | The change is the smallest one that solves the problem — it reuses what already exists and adds no dead code or needless abstraction. |
| standards-conformance#1 | standards-conformance | static-review | The change follows this repo's conventions and platform-native defaults, and does not diverge from a ratified standard or placement rule. |
| claim-accuracy#1 | claim-accuracy | static-review | Every factual claim the change makes about the repo holds against the repo: a cited path:line names what is actually there, a quoted grep literal really matches, a stated count is the real count, a referenced id or link resolves, and anything the description says was changed appears in the diff. |

## Done when

This is a decision item, not a build. Done when ratified via `/next decision`; the build lands through the
follow-on slices above.
