---
bornAs: x5uqim1
kind: story
size: 5
parent: "4075"
status: resolved
scope: ["we:scripts/conveyor/main-red-recovery.mjs", "we:scripts/conveyor/ci-red-recovery-watch.mjs", "we:scripts/conveyor/reconcile-core.mjs", "we:scripts/conveyor/reconcile-pass.mjs", "we:skills-src/conveyor/daemon-manifest.mjs", "we:scripts/conveyor/__tests__/main-red-recovery.test.mjs", "we:scripts/conveyor/__tests__/ci-red-recovery-watch.test.mjs", "we:scripts/conveyor/__tests__/reconcile-core.test.mjs", "we:scripts/conveyor/__tests__/reconcile-pass.test.mjs", "we:skills-src/conveyor/__tests__/pass-daemon.test.mjs"]
dateOpened: "2026-09-25"
dateStarted: "2026-09-25"
dateResolved: "2026-09-25"
tags: []
---

# Re-run CI after main recovers; classify red-CI-caused-by-red-main so ci-heal skips it

Live incident 2026-09-25: 4-5 ready-to-merge PRs (we:backlog, e.g. PR #2596/#2622/#2629/#2631/#2634 on we:) sat ~4.5h because their required 'test' check failed while origin/main's own CI was red (main fixed by PR #2638); nothing re-ran their stale CI once main recovered, and we:scripts/conveyor/ci-heal-pr-dispatch.mjs would have wrongly dispatched a ci-heal agent to 'repair' code that was never broken. Adds a pure classifier (we:scripts/conveyor/main-red-recovery.mjs) that reads origin/main's own CI run history to compute red windows, a new per-repo pass-daemon watcher (we:scripts/conveyor/ci-red-recovery-watch.mjs, wired via we:skills-src/conveyor/daemon-manifest.mjs) that reruns a PR's failed required-check run exactly once via 'gh run rerun <id> --failed' once it is confirmed attributable to a red-main window and main has since gone green, and a we:scripts/conveyor/reconcile-core.mjs change so a ci-red PR attributable to red main (and not yet rerun) refuses as a new 'owed-ci-rerun' kind instead of dispatching ci-heal.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
