---
name: feedback_harvest_cross_cutting_paradigms
description: "When researching a concrete component, extract the reusable cross-cutting paradigms as candidate composable intents — not just a component spec"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: d6d18ebc-48f5-401d-b559-bad8cb534ef2
---

When the user asks to research a concrete component (e.g. a dropdown), the real
deliverable is not a component spec — it is the set of **cross-cutting paradigms
the component composes**, each phrased as a candidate standalone intent/standard
reusable by other components (menu, popover, tooltip, combobox, date picker,
command palette, data table).

**Why:** Aligns with this repo's open-intent model ([[project_intents_open_design]]) —
standardize composable capabilities, not monolithic widgets. A component standard
then becomes a thin "composition manifest" rather than restating each behavior.

**How to apply:**
- Research the component thoroughly first (behaviors, a11y contract, states).
- Then add a "Cross-cutting paradigms" layer: a table of paradigm | what it owns |
  how the component uses it | other components that compose it.
- Flag which paradigms are strong promotion candidates (broad reuse + stable
  primary-source contract) vs. which likely belong to existing intent families
  and should be cross-linked, not re-specified.
- Example artifact: reports/2026-06-01-dropdown-ux-behaviors.md (paradigms incl.
  Anchored surface, Edge-aware placement, Dismissal & focus return, Focus
  delegation, Type-ahead seek, Selection model, Live-region status, Windowed
  collection).

Built via two deep-research passes + 3-vote adversarial verification; aligns with
[[feedback_authoring_standard_workflow]] (feature-inventory before design).
