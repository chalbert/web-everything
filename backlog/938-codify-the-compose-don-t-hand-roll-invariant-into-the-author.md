---
kind: task
status: resolved
dateOpened: "2026-06-18"
dateStarted: "2026-06-18"
dateResolved: "2026-06-18"
graduatedTo: docs/agent/design-first.md
tags: []
---

# Codify the compose-don't-hand-roll invariant into the authoring skills' pre-flight

Codification spawn of #933 (complement to the #937 gate, never the enforcement). The statute rule is already written (we:docs/agent/platform-decisions.md#compose-dont-handroll). This item lands the pre-flight step into the block/standard-authoring skills (new-standard, new-demo) and the we:AGENTS.md authoring rules: before wiring any interaction, search the trait registry (registerNavigation et al) and compose the existing trait; hand-rolling a covered pattern is a conformance defect. Cross-link to the gate so authors know the mechanical backstop exists.

## Progress (batch-2026-06-18) — resolved

The skills (`new-standard`, `new-demo`) are thin trigger+pointers, so the pre-flight landed in the
**method docs they point at**, plus the `we:AGENTS.md` hard-rule list:

- **[we:docs/agent/design-first.md](../docs/agent/design-first.md)** "Before implementing" — new step 4:
  compose the existing WE trait for any covered capability (search `registerNavigation`/provided
  `traits[]` first; declare consumed behaviors in `composesBehaviors` #936); hand-rolling is a defect the
  block-drift gate catches; new behavior ships as a new `CustomAttribute`. Links the statute.
- **[we:docs/agent/demo-workflow.md](../docs/agent/demo-workflow.md)** platform-first rule — extended the
  ACTIVE-surface bullet to cover **behavioral traits** (disclosure → `nav:section`, roving focus →
  `nav:list` MUST compose, not re-wire), citing incidents #870/#931.
- **[we:AGENTS.md](../AGENTS.md)** Hard rules — new rule **2a** (one line + statute link), beside the
  naming rule so it reads as a peer enforced-convention.

All three cross-link [we:docs/agent/platform-decisions.md#compose-dont-handroll](../docs/agent/platform-decisions.md)
so the mechanical backstop (the gate) is one hop away. Doc-only; gate green for this changeset (the lone
red is concurrent #949, out of scope).
