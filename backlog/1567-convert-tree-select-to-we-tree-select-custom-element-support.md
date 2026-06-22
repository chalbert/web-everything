---
kind: story
size: 3
parent: "1442"
status: open
blockedBy: ["1570"]
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
locus: frontierui
relatedProject: webcomponents
relatedReport: reports/2026-06-22-1442-slice-wave-3.md
tags: [packaging, custom-elements, block-model, conversion, tree-select, frontierui]
---

# Convert tree-select to we-tree-select custom element (support-both, persistent B)

Add a we-tree-select element facade over the existing fui:blocks/tree-select/TreeSelectBehavior.ts kernel via the support-both, persistent light-DOM (B) mechanism ruled by #1457, mirroring the shipping fui:blocks/stepper/StepperElement.ts reference. Wave-3 slice of the #1442 block-model burndown; flat application, no fork.

## Pre-flight (batch-2026-06-22-1545-1549) — fork: the StepperElement mirror doesn't resolve the data-source → `blockedBy: 1570`

Claimed + ground `fui:blocks/tree-select/TreeSelectBehavior.ts`: its constructor is
`(host, nodes: TreeNode[], opts)` — **data-array-driven**. The named reference `fui:blocks/stepper/StepperElement.ts`
wraps a kernel that **scans light-DOM markup** (`new StepperBehavior(this, {progression})` — no data to
source), so "mirror StepperElement, flat application, no fork" doesn't specify how `we-tree-select` supplies
its `TreeNode[]` (light-DOM parse with what markup convention? a `.nodes` property? a JSON attribute?) — the
element's authored public API, a real fork. Shared by #1568 (type-ahead, items) + #1569 (data-grid, rows) —
also data-driven kernels. Filed **#1570** (the persistent-B-over-data-kernel data-source decision);
`blockedBy: 1570`; released. Carry-forward reason: **not-batchable** (fork). No design call forced.
