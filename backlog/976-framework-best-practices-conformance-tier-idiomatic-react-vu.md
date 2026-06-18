---
type: decision
workItem: story
size: 5
status: open
dateOpened: "2026-06-18"
tags: []
---

# Framework best-practices conformance tier — idiomatic React/Vue lint axis for generated wrappers

Third graded-conformance dimension ratified by #913 (the lint axis, absent from the original survey). Decide the criteria + tool for an 'idiomatic-framework' check on genWrapper output: React (forwardRef, event-prop naming) and Vue (correct prop/emit declarations). Distinct from the surface-contract (#975) and behavioral (#967) tiers — it judges framework-idiom quality, not contract or behavior. Surfaces as a workbench badge labelled precisely 'best-practices'/'idiomatic' (honesty rule: never a bare 'conformance' label). Ownership per #899/constellation-placement: criteria → WE, lint runner → FUI. Needs a design pass to pick the criteria set and whether to reuse an existing framework linter.
