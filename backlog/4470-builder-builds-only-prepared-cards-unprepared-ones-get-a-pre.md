---
bornAs: xhmxvtc
kind: story
size: 3
tier: pinned
status: open
scope: ["we:scripts/conveyor/build-dispatch-policy.mjs", "we:scripts/readiness/dispatch-plan.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# Builder builds only prepared cards; unprepared ones get a prepare pass first

Operator rule (Mon 2026-09-28 6:00 PM ET): PREPARE = full design + explicit MVP cut; build only the MVP. The build daemon's queue (we:scripts/readiness/dispatch-plan.mjs, we:scripts/conveyor/build-dispatch-policy.mjs) dispatches unprepared cards anyway (dispatch-plan tags nearly every row 'unprep'). Live 2026-09-29 cost: #4295 built then declined (declared scope wrong), #4380 built but already done on main, #4108 built but superseded — each a full build agent run a prepare pass would have avoided. MVP: the builder dispatches a card only if it carries a truthful preparedDate; an unprepared queued card is dispatched as a PREPARE job instead (premise check vs main, scope corrected to the real touch-set, Design/MVP/Test plan/Proof plan written, prepare-stamp; already-done → resolve with graduatedTo; wrong premise → stop and report), and becomes build-eligible once stamped. Must: tests for the gate and the prepare route; soak break (unprepared card dispatched as a build) RED before / GREEN after; live proof: the next unprepared queued item gets a prepare job, not a build. Measure with #4304's prepared-vs-not run rating.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
