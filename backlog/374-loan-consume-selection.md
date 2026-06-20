---
kind: story
size: 5
status: resolved
parent: "317"
dateOpened: "2026-06-12"
dateResolved: "2026-06-12"
graduatedTo: "block:selection"
tags: [exercise-app, loan-origination, selection, master-detail, consumption-slice]
---

# Loan pipeline consumes a Selection runtime (row → trace master-detail)

Consumption slice of exercise app A ([#317](/backlog/317-exercise-app-loan-origination/)) — was the
remaining blocker to full conformance. **Resolved**: since the `selection` intent had no shipping
implementation (dropdown/droplist draft, no `sourcePath`) there was no reference renderer to wrap, so this
**built a new `selection` block** — `SelectionBehavior`, a list-selection runtime realizing the intent's
model/immediacy/variant (`aria-selected` + roving `tabindex` + click/keyboard, `selection-change` event),
with unit tests — and the loan pipeline's row→trace master-detail now runs through it. Benchmark reads
`selection` **conformant** → loan app at **100% Layer-1 conformance**. The master-detail *coordination*
(selection surviving sort/page re-renders) remains the seam tracked by [#356]/[#369].
