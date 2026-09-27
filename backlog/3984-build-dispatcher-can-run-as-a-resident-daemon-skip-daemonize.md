---
bornAs: xcd92xh
kind: task
parent: "3383"
status: active
scope: ["we:skills-src/conveyor/runner.mjs"]
dateOpened: "2026-09-23"
dateStarted: "2026-09-23"
tags: []
---

# build dispatcher can run as a resident daemon: skip daemonized passes, self-sync, App token

we:skills-src/conveyor/runner.mjs (the build Dispatcher) can't safely run unattended today: several of its inline mechanical passes duplicate standalone daemons (we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs, we:skills-src/conveyor/review-daemon.mjs, and the two we:skills-src/conveyor/pass-daemon.mjs watchers), and it lacks the per-tick self-sync + GitHub App token refresh those daemons already got. Adds --skip-pass=<name> (repeatable, typo-safe), wires we:scripts/lib/daemon-self-sync.mjs and we:scripts/lib/github-app-auth-env.mjs into its per-tick seam (self-sync is opt-in via --self-sync, off by default, because the runner also runs from the operator's live checkout), and stages a launchd plist example at we:skills-src/conveyor/launchd/com.we.dispatcher.plist.example (not installed).

## Done when

1. **Executable** — `npx vitest run we:skills-src/conveyor/__tests__/runner.test.mjs` passes, including the `resolveSkipPasses`, `makeCliMechanicalPasses` skipPasses, and `wireSelfSyncAndAppAuth` ordering suites this item adds (they do not exist before it lands).

## Design: the standalone build-dispatch daemon (operator priority, 2026-09-27)

The `--skip-pass`/self-sync/plist work above landed, but a resident we:skills-src/conveyor/runner.mjs still only SURFACES `spawnBuilds` — something still has to execute them, and today that is the orchestrator session (the cost this item exists to cut). So builds get their own daemon, we:skills-src/conveyor/build-dispatch-daemon.mjs, beside the review / fix-dispatch / verify / pass daemons:

- **Each tick:** shell tick-core for `spawnBuilds` (the core keeps every guard: lanes, scope-lease arbitration, readiness, capacity) → run the operator policy over it (we:scripts/conveyor/build-dispatch-policy.mjs) → for each survivor take a durable claim, then run the existing `dispatch-lane` operation with `WE_BUILD_DISPATCH_MODE=mechanical`. Routing (Codex vs Claude) is NOT re-derived: dispatch-lane applies the #3906 table, the #4034 critical-work gate and the card's `deliveryAgent:` marker. No other pass runs in this daemon.
- **Declared policy** (`BUILD_DISPATCH_POLICY.rules`, each with its enforcer): cap 3 concurrent builds (max of durable in-flight and the tick core's own building tally); landing freeze while open PRs > 12 or any open PR carries `review-status:{fix,ci-heal,review}-stalled` / `blocked:daemon-bug`; scope vs every open PR's files; hot-file serialisation (claims store scope); planned ref must not start with a bare number; task-prefixed scratch files (brief — follow-up card) and draft-first PRs (PR #2813).
- **One singleton lease** (keyed `<conveyor:build-dispatch-daemon-lease>`, independent heartbeat as in the verify daemon).
- **No double dispatch across restarts:** we:scripts/conveyor/build-dispatch-claim.mjs — the PR #2789 claim shape (O_EXCL mkdir + TTL, coordination root, owner host:pid) keyed `build-dispatch:<repo>:<num>`, retired only by observed progress (a PR delivers the item, or it left the cleared queue) or dispatch failure; TTL 240 min is the dead-holder floor. Soak break `build-daemon-restart-same-file` proves it across two real processes.
- **Kill switch:** `WE_BUILD_DAEMON_KILL=1` or `<coordination root>/build-dispatch-daemon.kill`; dispatch also requires `--live`. `--dry-run` is read-only.
- **State pins:** `CONVEYOR_STATE_ROOT` (queue, #4052) and `OPERATION_RUNS_DIR` (dispatch-lane run records) point outside the self-syncing clone.

**Slice 1 (this PR):** the daemon, policy, claim, plist template (not installed), unit tests + soak break. **Later slices:** health integration + claim inside dispatch-lane + brief scratch prefix (#xw24bu0), per-demand token budget from run rating (#xik3fkr), Codex/Claude routing learned from the scorebook (#xicxbh4).
