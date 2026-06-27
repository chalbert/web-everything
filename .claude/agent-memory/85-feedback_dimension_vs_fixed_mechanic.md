---
name: feedback-dimension-vs-fixed-mechanic
description: "When authoring a standard, expose a fork as a configurable dimension only if both branches are legitimate end-states; otherwise bake it as a fixed mechanic"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: ad728334-a994-4a49-84d7-15f51352c78e
---

When a design fork comes up while authoring a standard (block/intent/adapter), decide whether to expose it as a configurable dimension/trait or bake it as a fixed architectural decision using this test: **a fork becomes a configurable axis only when both branches are legitimate end-states for different products; it stays a fixed mechanic when one branch is simply the correct way to build the contract and variants would fragment interop.**

**Why:** Making internal mechanics configurable buys nothing and breaks interop — "two registration protocols = no protocol." Conversely, baking a genuinely product-dependent choice forces a wrong default on half the consumers.

**How to apply:** For each open question, ask "would two real products legitimately land on different branches?" If yes → dimension (record default + trait). If no → fixed decision (record in `designDecisions` with rationale). Worked example: the [[project_droplist_traits_model]]-adjacent Background Task Surface block (#128) — registration (event bus) and surface resolution (nearest-ancestor) were fixed mechanics; aggregation/persistence/navigationGuard/durability were dimensions. Pairs with [[feedback_native_first_default]] (the baseline branch is the native default; enhancements are opt-in dimensions) and [[feedback_authoring_standard_workflow]].
