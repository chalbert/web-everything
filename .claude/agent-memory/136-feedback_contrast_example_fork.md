---
name: feedback_contrast_example_fork
description: "a decision's rejected/contrast example must demonstrate the ACTUAL fork test, not a weaker secondary objection"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 161dc249-f8ea-4d93-9f2b-a5046d787c89
---

A decision item's "rejected example" / contrast case must illustrate the *actual* discriminating test the fork turns on — not a different, weaker objection that happens to also disqualify it.

**Why:** On #1795 the rejected `(b)` example was `<nav-item variant="compact" density="tight" badge-style="dot" …>` — but the fork's test was *a11y-contract ownership* (does the variation CHANGE roles/focus/keyboard?), and every one of those attributes is purely visual, so none of them triggers the rule. The example actually demonstrated the weaker #023 "config-matrix sprawl" objection, conflating two distinct reasons-to-reject. The user caught it by asking "which attribute causes rejection?" — the honest answer was "none of them," which exposed the example as not demonstrating the decision at all. Fixed to `<nav-item as="menubar">` (forces `role=menuitem` + a different keyboard model) — the attribute that genuinely crosses the ratified line.

**How to apply:** When authoring/reviewing a decision's contrast or rejected example, run the item's own test against the example attribute-by-attribute and name *which specific element* trips it. If you can't point to the one that crosses the line, the example is illustrating something else — rebuild it around the real discriminator, and if a second objection is also in play, separate it explicitly. Ties to [[feedback_examples_go_in_the_story]] and [[feedback_decision_concrete_code_refs]].
