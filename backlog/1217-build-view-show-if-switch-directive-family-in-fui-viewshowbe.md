---
type: issue
workItem: story
size: 8
parent: "904"
locus: frontierui
status: open
dateOpened: "2026-06-20"
tags: []
---

# Build view show/if/switch directive family in FUI (ViewShowBehavior/ViewIfDirective/ViewSwitchDirective)

Build verdict from #1165 (export-shape drift). View's contract declares ViewShowBehavior/ViewIfDirective/ViewSwitchDirective — the structural control-flow directive family View's own architecture promises ('specialized blocks (behaviors + directives)') — but fui:blocks/view/index.ts ships only ViewEngine + ViewBehavior. These are load-bearing (a capability ViewBehavior's imperative show/hide lacks: add/remove subtrees + branch selection over CustomTemplateDirective, view:show expression-bound via the shipped webexpressions layer), not additive sugar, so #1165 ruled build over trim. Building them clears the residual view export-shape warning and is a prerequisite (with #1164) to flipping EXPORT_SHAPE_ENFORCED. Slice of #904.
