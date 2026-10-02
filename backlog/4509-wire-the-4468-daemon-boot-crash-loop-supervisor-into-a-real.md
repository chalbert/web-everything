---
bornAs: xmbljjc
kind: story
size: 3
status: open
blockedBy: ["4468"]
scope: ["we:scripts/lib/daemon-boot-watchdog.mjs", "we:skills-src/conveyor/launchd/com.we.health-watch.plist.example", "we:scripts/lib/__tests__/daemon-boot-watchdog*.test.mjs"]
dateOpened: "2026-09-29"
preparedDate: "2026-10-01"
preparedAgainstSha: "3aa47415089804e2b1274f5a66571ca8b87f0303"
tags: []
---

# Wire the #4468 daemon boot-crash-loop supervisor into a real daemon's launch config

#4468 built the crash-loop-revert mechanism (we:scripts/lib/daemon-boot-watchdog.mjs: decideCrashLoop + runSupervisedStart) as a standalone, tested module, deliberately NOT wired into any real daemon's launch path (historically also the initial scope of we:skills-src/conveyor/daemon-manifest.mjs; that manifest now contains real entries) — proven only against a scratch clone, per the never-restart-a-real-daemon constraint on that item. This follow-up does the real wiring: point at least one real standalone daemon's actual launch (today a bare node invocation of its own entry module under launchd KeepAlive) at the supervisor CLI in place of the bare entry, choose real N/K values from observed real boot times, and prove it live on that one real daemon's own dedicated clone without ever leaving it down.

## Done when

1. **Real daemon wiring** — one real standalone daemon's launch config (today a bare `node <entry>.mjs`
   invocation under launchd `KeepAlive`) starts through `we:scripts/lib/daemon-boot-watchdog.mjs`'s CLI in
   place of the bare entry — verifiable by reading that daemon's actual launch config/plist and confirming the
   command line names the watchdog script, not the entry directly.
2. **Tuned N/K** — the survival window and crash-loop count are set from real observed boot times for that
   daemon (not left at the library defaults) and the values are recorded in this item's own body with the
   observation they came from.
3. **Live proof, no downtime** — a deliberately-broken commit is loaded onto that daemon's OWN dedicated
   clone and the daemon self-heals (reverts and restarts clean) with no manual intervention and no extended
   outage — proven by a timestamped before/after log excerpt in the PR body, not merely inferred from a green
   gate.


## Progress

Preparation research, 2026-10-01 (no live configuration changed):

- **Old premise/scope:** wiring was described as replacing a bare entry invocation with an already suitable CLI, with the whole we:skills-src/conveyor directory in scope and no matching tests.
- **Corrected premise/scope:** target the existing health-watch launch only. Read-only inspection of the installed LaunchAgent labelled `com.we.health-watch` found `KeepAlive=true`, `ThrottleInterval=60`, a dedicated clone named `wev-health-watch`, and direct execution of we:skills-src/conveyor/pass-daemon.mjs with `--pass=health-watch`; no boot-watchdog environment overrides. This establishes an installed configuration, not current process health. Its tracked template is we:skills-src/conveyor/launchd/com.we.health-watch.plist.example. The dedicated failure domain is already required by we:docs/agent/platform-decisions.md#automated-health-daemon. No manifest or health-pass behavior change is needed.
- **Source evidence:** we:scripts/lib/daemon-boot-watchdog.mjs (`main`, `defaultSpawn`, `runSupervisedStart`) implements one attempt, passes an empty argument list from its CLI, spawns detached with ignored stdio, and has no explicit signal-forwarding or spawn-error handler. Survival returns a child handle; it is not a deliberate CLI lifecycle contract. A successful rollback returns without spawning, so recovery currently requires another invocation. These are necessary integration work, not an already-delivered launch wrapper.
- **Existing proof:** commit `5e30dce28` delivered the mechanism. we:scripts/lib/__tests__/daemon-boot-watchdog.test.mjs covers the decision/state logic; we:scripts/lib/__tests__/daemon-boot-watchdog-live.test.mjs exercises real scratch-clone recovery and CLI invocation. Neither proves the installed real launch configuration. we:scripts/lib/daemon-live-smoke.mjs (`rollbackToSha`) refuses absent targets, dirty clones and failed status reads, then resets to the supplied SHA; preserve those refusals.
- **Availability wording:** deliberate boot failures necessarily create a bounded interruption. “Without ever leaving it down” means automatic recovery with a measured interruption and a prepared rescue, not literal continuous availability during an injected crash. No boot timings, tuned values or real-daemon recovery are claimed by this preparation.

## Design

Use launchd as the sole restart scheduler for the health-watch process. Extend we:scripts/lib/daemon-boot-watchdog.mjs into a launch-compatible wrapper while preserving the existing one-attempt API and head-tied consecutive-failure rule. Accept daemon arguments after `--`, preserving their order and values; use the same Node executable as the wrapper and the configured clone as cwd. Inherit stdout/stderr into launchd's existing log destinations. Handle spawn errors deterministically without an unhandled event or false boot confirmation.

Keep the wrapper resident until its child exits, including after survival confirmation. Forward termination signals to the owned child/process group, wait for shutdown, and do not count an operator-requested shutdown as a boot crash. Preserve self-sync's clean-exit restart behavior. Each wrapper invocation owns at most one daemon child; launchd starts the next invocation only after that child is gone. A rollback-only invocation exits after reporting its result; the next launchd invocation boots the restored SHA. Do not add a second internal restart loop.

Change we:skills-src/conveyor/launchd/com.we.health-watch.plist.example to invoke the watchdog with clone and entry flags followed by `-- --pass=health-watch`. Preserve authentication, state-root, self-sync, lease identity and log configuration. Include explicit `WE_DAEMON_BOOT_SURVIVAL_MS` and `WE_DAEMON_BOOT_CRASH_LOOP_COUNT` values selected during the measured live exercise, not invented during preparation. Account for the existing 60-second launchd throttle in the recovery timeline; include the rollback-only invocation in that accounting.

The watchdog must remain bootable at both the candidate and recovery commits. Establish a known-good SHA containing the launch-compatible wrapper before injecting a fault confined to the daemon entry. This item proves daemon-entry boot recovery, not recovery from a broken watchdog or one of its own imports. Survival is a liveness criterion; separately observe a completed health tick to prove useful recovery.

## MVP

1. Implement argument forwarding, log inheritance, spawn-error handling and child/signal lifetime handling in we:scripts/lib/daemon-boot-watchdog.mjs, with the matching tests in scope.
2. Update the single health-watch template at we:skills-src/conveyor/launchd/com.we.health-watch.plist.example. Test the template's command/argument/environment contract in planned we:scripts/lib/__tests__/daemon-boot-watchdog-launch.test.mjs. Do not roll out to other daemons.
3. Stage the compatible good revision on the health daemon's dedicated clone and measure real start-to-started-log and start-to-completed-tick times. Record timestamped samples, host conditions, selected N/K and the resulting recovery bound here. N must exceed observed normal startup with documented margin; justify K against observed transient failures and the resulting interruption, rather than claiming boot time alone determines K.
4. Install through the existing operator-controlled launch-config workflow, read back the actual installed command, and execute the live proof below. A changed example alone does not satisfy Done when.

## Test plan

- Extend we:scripts/lib/__tests__/daemon-boot-watchdog.test.mjs for spawn failure, intentional shutdown exclusion and lifetime transitions; retain mixed-head, consecutive-tail, state persistence and rollback-refusal coverage.
- Extend we:scripts/lib/__tests__/daemon-boot-watchdog-live.test.mjs with real child processes: exact forwarded argv/cwd/environment, captured child logs, wrapper remaining alive past N, late exit and clean self-sync-style exit, signal delivery and no orphan child. Exercise good SHA → K fast exits at bad SHA → rollback-only invocation → healthy invocation, with isolated state and cleanup.
- Add we:scripts/lib/__tests__/daemon-boot-watchdog-launch.test.mjs to check the real tracked health-watch template names the watchdog, correct entry and pass argument, explicit tuning variables, KeepAlive and retained log/state configuration. This is the matching test for the template source entry.
- Run the three watchdog test files with Vitest and the repository standards gate during implementation. Scratch tests are prerequisites, not substitutes for the real launchd proof. The preparation runner owns preparation checks.

## Proof plan

Before changing the real daemon, read its loaded launchd job, installed command, dedicated clone HEAD/cleanliness, process ownership, state location and latest completed tick. Save the prior launch configuration and recoverable good SHA. Ensure the clone is exclusive to this daemon and no tick is in flight at the controlled restart. Keep an outside observer: the health watcher cannot be its own outage witness.

First run the good revision through the installed wrapper long enough to record boot confirmation and a completed tick. Record its SHA, wrapper/child PIDs, timestamps and persisted state. Measure normal boot samples and select explicit N/K; include launchd throttle and tick duration when calculating a finite observation deadline. Do not inject the fault without a confirmed good target or if the measured interruption cannot meet the item's bounded-recovery requirement.

Load a committed entry-only boot failure onto that same dedicated clone, with a clean worktree and unchanged bootable supervisor. Keep the fault out of the persistent overlay registry and upstream so self-sync cannot reintroduce it. Observe K fast exits on the same candidate, the subsequent rollback-only invocation and launchd's following healthy start. No manual reset/restart is allowed inside a passing proof. Capture timestamped logs, before/bad/restored SHAs, boot-state records, wrapper/child ownership and a newly completed health tick; verify no duplicate lease holder or orphan child. Continue through a self-sync cycle to show the bad candidate does not return.

If recovery exceeds the recorded deadline, use the saved configuration and known-good revision to restore service, report a failed proof and diagnose before retrying. Rescue is not a passing self-heal. Put the actual installed-command readback, N/K derivation, measured interruption and timestamped before/after evidence in this card and the implementation PR. Nothing in this preparation performs installation, restart or fault injection.

## Follow-ups

- Extend rollout to additional dedicated daemon clones only after this single-daemon proof; each requires its own launch arguments, tuning and live evidence.
- Recovery from a broken supervisor/import graph, persistent faulty overlay re-adoption and readiness beyond process survival remain separate hardening work. Do not claim this entry-crash proof covers them.
- Keep broad manifest/health-pass changes out of this slice. If the live exercise exposes a necessary dependency change, record its observed cause and add its matching test scope before implementation expands.
