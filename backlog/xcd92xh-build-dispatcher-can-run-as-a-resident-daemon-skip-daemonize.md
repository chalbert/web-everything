---
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
