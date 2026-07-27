---
kind: story
size: 5
parent: "2676"
status: open
dateOpened: "2026-07-27"
tags: []
---

# Integration phase: compose parts into one operable page + integration-only review

The loop designs and validates PARTS via an all-states proof sheet, but parts that each pass review do not add up to a coherent screen. Add an explicit INTEGRATION phase that composes them into one operable screen with a real interaction model and reviews specifically for problems only integration reveals — emitting BOTH a states proof sheet AND an integrated page.

Operator insight that motivated this: "having all states is helpful, but some problems and refinements are only obvious once we integrate." The tool should treat the states sheet as a coverage spec and the integrated page as a separate deliverable, and run an integration-specific review pass.

Captured from the **feature-tracking-screen** design session — a capability the design-studio tool (#2676) should productize, drawn from methodology we ran by hand. Decision-view artifact: https://claude.ai/code/artifact/ba98baf4-3430-47bd-b90b-386be86d529d
