---
type: issue
workItem: task
parent: "658"
status: open
blockedBy: ["693"]
dateOpened: "2026-06-15"
tags: []
---

# Migrate the 6 single-file WE-only block families UP to @frontierui/blocks

S2a of #658. Migrate the 6 single-file WE-only families (audit/AuditProvider, lifecycle/LifecycleProvider, master-detail/MasterDetailBehavior, selection/SelectionBehavior, stepper/StepperBehavior, tree-select/TreeSelectBehavior) UP to @frontierui/blocks — impl + register + their unit tests — byte-verified against WE's copies, WITHOUT deleting WE's copies (the #170 migration-order guard: content-equal upstream first). Add each to the S1 exports map. Independent of S2b/S2c. Leaves both trees valid (FUI tests green; WE copies still serve demos).
