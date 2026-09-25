---
bornAs: x9gnyt9
kind: task
parent: "4075"
status: open
scope: ["we:scripts/operations/ci-heal-pr-dispatch.mjs", "we:scripts/operations/__tests__/ci-heal-pr-dispatch.test.mjs"]
dateOpened: "2026-09-25"
tags: []
---

# ci-heal dispatch throws on empty SCOPE instead of degrading to an unfenced heal

we:scripts/operations/ci-heal-pr-dispatch.mjs#dispatchCiHeal required a non-blank SCOPE, so a red PR naming no backlog item whose diff-derived scope also came back empty (a gh hiccup, not just no-item — live incident 2026-09-25, PRs #2653/#2636/#2635) threw dispatch-lane: no value for the brief placeholder {{SCOPE}} deep inside fillBrief, surfacing one level up in we:scripts/operations/ci-heal-pr-dispatch.mjs#runReconcileCiHealDispatch as an opaque dispatch-failed refusal that also leaked the lane it popped. we:scripts/conveyor/reconcile-fix-dispatch.mjs#planFixesFromReconcile already refuses this cleanly (no-scope) before ever reaching dispatchFix for the fix kind — ci-heal had no equivalent gate. Fixed by making SCOPE optional in the ci-heal fillBrief call (falls back to an honestly unfenced heal) rather than crashing; the diff-derived scope upstream (we:scripts/conveyor/pr-work-unit.mjs#resolvePrWorkUnit) still supplies a real fence whenever gh cooperates.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
