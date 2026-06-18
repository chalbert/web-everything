---
type: issue
workItem: task
status: open
dateOpened: "2026-06-18"
tags: []
---

# Codify the compose-don't-hand-roll invariant into the authoring skills' pre-flight

Codification spawn of #933 (complement to the #937 gate, never the enforcement). The statute rule is already written (we:docs/agent/platform-decisions.md#compose-dont-handroll). This item lands the pre-flight step into the block/standard-authoring skills (new-standard, new-demo) and the we:AGENTS.md authoring rules: before wiring any interaction, search the trait registry (registerNavigation et al) and compose the existing trait; hand-rolling a covered pattern is a conformance defect. Cross-link to the gate so authors know the mechanical backstop exists.
