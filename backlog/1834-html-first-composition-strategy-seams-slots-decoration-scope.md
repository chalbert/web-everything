---
kind: story
size: 8
status: open
dateOpened: "2026-06-27"
tags: []
---

# HTML-first composition strategy seams (slots, decoration, scoped-replace, abstract-split)

Build the four sanctioned add-only composition seams ratified in #1795: slots (`<component>` shadow `<slot>` + `HTMLSlotElement.assign`), behavior/decoration (`CustomAttribute` child-decorator, the `route:link` pattern), sub-component replacement (scoped registry + IDREF per #component-dc — runtime BLOCKED on the webregistries FUI re-home), and abstract-piece-split (userland convention, no WE primitive). Each seam preserves the base a11y contract add-only. Rule: we:docs/agent/platform-decisions.md#composition-preserves-a11y-contract.
