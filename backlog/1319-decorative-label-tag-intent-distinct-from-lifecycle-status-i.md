---
kind: decision
status: open
dateOpened: "2026-06-20"
tags: [reproduction, gap-sweep, shadcn]
relatedProject: webintents
relatedReport: reports/2026-06-20-1243-shadcn-first-gap-delta.md
---

# Decorative label/tag intent distinct from lifecycle Status Indicator

Reproduction-conformance gap #6 from shadcn (#1243). Status Indicator Intent is lifecycle-state-driven (an entity's current state + next transitions); shadcn's badge is a decorative/standalone label with tone variants and no lifecycle semantics — mapping a decorative badge onto a lifecycle chip over-constrains it. Decide whether to add a decorative label/tag intent distinct from Status Indicator, or widen Status Indicator to cover the decorative case. Surfaced by reproduction #1243, feeds gap-sweep #315.
