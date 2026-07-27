---
bornAs: x9cuge3
kind: story
size: 5
parent: "2705"
status: open
blockedBy: ["2725", "2691"]
scope: ["plateau-app:src/feature-tracker/rollup.ts", "plateau-app:src/feature-tracker/rollup.css", "plateau-app:src/feature-tracker/read-model.ts"]
dateOpened: "2026-07-27"
tags: []
---

# S5 · Epic→slice rollup with connector rails

Feature-epic-slice rollup with connector rails: expandable epic nodes (mini progress bar, blocked flag, pts), slice rows with state chips, expand/collapse-all. Registers into the section registry. Interim epic-slice ships now; the #2691 adapter later adds the real feature tier above epics.

## Deliverable
Feature → epic → slice rollup with connector rails: expandable epic nodes (mini progress bar, blocked flag, pts), slice rows with state chips, expand/collapse-all. Registers into the section registry. The interim epic → slice ships now; the #2691 adapter later adds the real feature tier ABOVE epics.

## FT cases → rendered=yes
M9–M12 (+M13 spec); M14–M17.

## Scope
- `plateau-app:src/feature-tracker/rollup.ts`
- `plateau-app:src/feature-tracker/rollup.css`
- `plateau-app:src/feature-tracker/read-model.ts` (owned re-edit)

## Acceptance
Rails + node states match baseline in both themes; slice chips reflect state; with #2691 the feature tier sits above epics and rollup pts reconcile with the burn-up total; the interim epic → slice is coherent standalone.
