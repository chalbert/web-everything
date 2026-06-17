---
type: issue
workItem: story
size: 5
parent: "872"
status: open
blockedBy: ["874", "879"]
dateOpened: "2026-06-17"
tags: []
---

# Migrate FUI byte-copied contracts to @webeverything/contracts imports

Replace FUI's byte-copied contract code with imports from @webeverything/contracts: guard (the #834/#836 copy) plus the contract types embedded in the #694-migrated families (audit, lifecycle, master-detail, selection, stepper, tree-select). FUI keeps the runtime impl; the contract halves come from the published package. Removes the corresponding #170 byte-equality drift gates for the migrated contracts (superseded by the package dependency). This is where the byte-copy interim ratified in #834 gets retired.
