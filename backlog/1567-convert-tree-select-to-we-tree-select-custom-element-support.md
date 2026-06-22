---
kind: story
size: 3
parent: "1442"
status: open
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
locus: frontierui
relatedProject: webcomponents
relatedReport: reports/2026-06-22-1442-slice-wave-3.md
tags: [packaging, custom-elements, block-model, conversion, tree-select, frontierui]
---

# Convert tree-select to we-tree-select custom element (support-both, persistent B)

Add a we-tree-select element facade over the existing fui:blocks/tree-select/TreeSelectBehavior.ts kernel via the support-both, persistent light-DOM (B) mechanism ruled by #1457, mirroring the shipping fui:blocks/wizard/WizardElement.ts reference (property-sourced render-from-data; reference repointed from StepperElement per #1570). Wave-3 slice of the #1442 block-model burndown; flat application, no fork.

## Pre-flight (batch-2026-06-22-1545-1549) — fork: the StepperElement mirror doesn't resolve the data-source → `blockedBy: 1570`

Claimed + ground `fui:blocks/tree-select/TreeSelectBehavior.ts`: its constructor is
`(host, nodes: TreeNode[], opts)` — **data-array-driven**. The named reference `fui:blocks/stepper/StepperElement.ts`
wraps a kernel that **scans light-DOM markup** (`new StepperBehavior(this, {progression})` — no data to
source), so "mirror StepperElement, flat application, no fork" doesn't specify how `we-tree-select` supplies
its `TreeNode[]` (light-DOM parse with what markup convention? a `.nodes` property? a JSON attribute?) — the
element's authored public API, a real fork. Shared by #1568 (type-ahead, items) + #1569 (data-grid, rows) —
also data-driven kernels. Filed **#1570** (the persistent-B-over-data-kernel data-source decision);
`blockedBy: 1570`; released. Carry-forward reason: **not-batchable** (fork). No design call forced.

## Data-source resolved (#1570, ratified 2026-06-22)

Fork ruled **(b) typed `.nodes` property (B)**: `we-tree-select` exposes `.nodes` set programmatically and the kernel renders from it unchanged — mirror `fui:blocks/wizard/WizardElement.ts:39` (property-sourced render-from-data), **not** `StepperElement`. Light-DOM markup parse (A) is rejected as primary — the kernel does `host.innerHTML = ''` (`fui:blocks/tree-select/TreeSelectBehavior.ts:36`), so author markup is destroyed; FUI persistent-B is light-DOM/no-shadow, so markup can't be the live source of truth. An **optional** declarative form is `nodes="[[ data.tree ]]"` — the element's **own** observed attribute resolved in its own lifecycle, reusing `we:plugs/webexpressions/CustomExpressionParser` as a library (NOT a globally-registered `CustomAttribute`). That binding is a forward additive; this slice ships the plain `.nodes` property as its floor. The trio's shared-fork premise was wrong for #1568/#1569 (light-DOM-scan kernels) — both unblocked. `blockedBy: 1570` cleared (decision resolved); lineage is this note + the `relatedReport`. Now agent-ready.
