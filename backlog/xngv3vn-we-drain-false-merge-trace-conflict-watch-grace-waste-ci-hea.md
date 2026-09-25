---
kind: story
size: 5
parent: "4075"
status: active
scope: ["we:scripts/merge-ai-prs.mjs", "we:scripts/conveyor/parked-pr-conflict-watch.mjs", "we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs", "we:scripts/operations/ci-heal-pr-dispatch.mjs"]
dateOpened: "2026-09-24"
dateStarted: "2026-09-24"
tags: []
---

# we: drain false merge-trace, conflict-watch grace waste, ci-heal never dispatched

Three coupled #2596-class production bugs found live 2026-09-24: (1) we:scripts/merge-ai-prs.mjs posts its merge-trace comment ('landed head ... merged by drain') UNCONDITIONALLY before attempting gh pr merge, so a PR that fails to merge (real conflict) still carries a false landed claim; (2) we:scripts/conveyor/parked-pr-conflict-watch.mjs's queued-conflict grace (QUEUED_CONFLICT_GRACE_MS) waits the full 30min even when the conflict is NOT drain-resolvable (non-manifest files), wasting the grace on a conflict the drain can never heal; (3) we:scripts/operations/ci-heal-pr-dispatch.mjs#runReconcileCiHealDispatch has no caller in any running daemon — we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs's tick never invokes it, so ci-heal is planned but never dispatched.

## Done when

1. **Executable** — `npm run test:unit -- we:scripts/__tests__/merge-ai-prs-merge-trace-post-confirm.test.mjs we:scripts/conveyor/__tests__/parked-pr-conflict-watch.test.mjs we:skills-src/conveyor/__tests__/reconcile-fix-dispatch-daemon.test.mjs` fails on the pre-fix source (proven RED via `git stash` per-file in-session) and passes after this item's three commits land.
