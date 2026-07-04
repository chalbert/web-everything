---
name: feedback-behavior-can-do-vs-element-is-a
description: "behavior = \"can do that\" (capability/enhancement on a host, headless, verb); element/block = \"is a\" (styled packaged identity, noun); even if a behavior CAN style it shouldn't — category error"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 4f230718-1586-416b-a41d-ac8b0d1b0285
---

The element-vs-behavior packaging test is **ontological, not technical**: a **behavior** (CustomAttribute)
is a **"can do that"** — a capability/enhancement attached to a host (verb/adjective, headless, the author
owns the markup); an **element/block** is an **"is a"** — an identity: the styled, packaged, nameable,
framework-flavorable *thing* (noun).

**Even if a behavior technically *can* do an is-a job (e.g. apply FUI's style classes to the markup it
discovers), it should not** — owning a styled/packaged identity is an *is-a* concern; folding it into a
*can-do* capability conflates the two categories. "It's technically possible" is not the test; the category
is.

**How to apply:** ask *is it a thing or a capability?* A thing you instantiate / style / name / generate
framework flavors of → **element/block** (is-a). A capability you attach to enhance a host → **behavior**
(can-do). They compose (support-both), but the styled product is the element and the behavior is the
headless capability beneath it. **Why:** mis-classifying a thing as a behavior (the #1457 prep's "coordinator
→ no we- element, stay attribute" default) sees only the can-do half and blocks FUI from shipping the styled,
flavorable component — a `<we-stepper>`/`<we-tabs>`/`<we-deck>` *is a* component, not just author markup that
*can behave as* one. Surfaced 2026-06-21 on #1457; user: "a behavior is a 'can do that' not a 'is a'." Relates
to [[feedback_composability_probe_strip_effort_loop]], [[project_dogfood_we_site_on_fui_components]],
packaging governance #1321/#1381.
