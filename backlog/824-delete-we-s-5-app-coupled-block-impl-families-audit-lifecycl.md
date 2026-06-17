---
type: issue
workItem: story
size: 5
parent: "658"
status: open
blockedBy: ["823"]
dateOpened: "2026-06-17"
tags: []
---

# Delete WE's 6 app-coupled block-impl families (audit/lifecycle/master-detail/selection/stepper/tree-select) after the exercise apps move to FUI

The app-coupled half of #697's blocks deletion (split out 2026-06-17). **6 families**: `audit`,
`lifecycle`, `master-detail`, `selection`, `stepper`, `tree-select`. Five are composed as CLASSES by the
two exercise apps (`loan-origination/app.ts`, `auto-insurance/app.ts`), so they cannot be deleted until
those apps move to FUI (**#823**, the blocker). `selection` joins them: `master-detail/MasterDetailBehavior.ts:11`
imports `../selection/SelectionBehavior`, pinning it until master-detail goes. When unblocked: delete the 6
vendored families (byte-identical upstream in `@frontierui/blocks`, #170 satisfied); their `blocks.json`
contracts already point to FUI (#657) so leave them, and the generated `custom-elements.json` follows. #697
takes only the 3 genuinely-free families (`type-ahead`, `background-task-surface`, `data-grid`).
