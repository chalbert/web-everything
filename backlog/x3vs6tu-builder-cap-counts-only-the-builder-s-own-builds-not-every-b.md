---
kind: story
size: 2
tier: pinned
status: open
scope: ["we:scripts/conveyor/build-dispatch-policy.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# Builder cap counts only the builder's own builds, not every building lane

Live 2026-09-29 ~10:35 AM ET: we:scripts/conveyor/build-dispatch-policy.mjs computes busy = max(its own in-flight builds, externalBuilding) where externalBuilding is the conveyor's machine-wide 'building' count (hand-dispatched workers, fix workers, stranded claims). With 2 stranded claims + 4 workers the builder read '6 building' at cap 6 and dispatched nothing for 30+ minutes while 116 items were queued; at the operator's chosen cap 3 it would never build while workers run. Operator decision (2026-09-29): the builder cap bounds the builder's own concurrent builds; machine load stays with the separate load guard (#4076) and heavy-admission slots. MVP: drop externalBuilding from the cap arithmetic (keep it as a logged signal), or make it a separate optional machineCap policy field off by default. Must: unit test (6 external building, 0 own, cap 3 → 3 slots); soak break RED before / GREEN after; live proof: the builder dispatches while workers are running.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
