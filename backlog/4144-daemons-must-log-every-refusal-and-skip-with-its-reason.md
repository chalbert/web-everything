---
bornAs: x0mn6x0
kind: story
size: 3
parent: "4075"
status: resolved
scope: ["we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs", "we:scripts/operations/ci-heal-pr-dispatch.mjs", "we:scripts/conveyor/reconcile-fix-dispatch.mjs", "we:skills-src/conveyor/pass-daemon.mjs"]
dateOpened: "2026-09-25"
dateResolved: "2026-09-25"
tags: []
---

# Daemons must log every refusal and skip with its reason

Live incident 2026-09-25: we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs's onTick only logs a refusal COUNT ('dispatched 0, refused N'), never the per-refusal kind/repo/pr/why — even though we:scripts/conveyor/reconcile-core.mjs already computes rich refusal objects and we:scripts/operations/ci-heal-pr-dispatch.mjs's own runReconcileCiHealDispatch collapses the reconcile layer's own refusals array to reconcileRefusals:<count>, discarding every reason. PRs #2635/#2636/#2653 sat red with 'dispatched 0, refused N' and no way to tell why without a live overlay probe. Make onTick print one line per refusal (repo, PR, kind, why) for both the fix and ci-heal halves, and surface the reconcile-side refusal reasons instead of a bare count. Apply the same to we:skills-src/conveyor/pass-daemon.mjs if its passes return refusals. we:skills-src/conveyor/review-daemon.mjs, we:scripts/conveyor/reconcile-core.mjs and we:scripts/conveyor/session-reaper.mjs are owned by another worker and out of scope here.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
