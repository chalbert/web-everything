---
kind: story
size: 5
status: open
blockedBy: ["1254"]
dateOpened: "2026-06-20"
tags: []
---

# plateau-app render-conformance gate — give 'preserve once landed' teeth (check:app-conformance analogue)

Build a check:-style gate that flags hand-rolled UI on plateau-app surfaces already migrated onto FUI, so the #1253 first-party-dogfood 'preserve once landed' clause is enforced, not just cited. Analogue of check:app-conformance for the exercise-app loop (#314): a migrated surface regressing back to document.createElement/bespoke CSS for a covered FUI pattern is a gated defect. Detection heuristic TBD (createElement/innerHTML density on migrated files vs an allowlist). Filed as the enforcement residual of the #1253 ratification; not a precondition for the charter.
