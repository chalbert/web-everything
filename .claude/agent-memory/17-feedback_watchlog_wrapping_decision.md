---
name: feedback-watchlog-wrapping-decision
description: "A standing \"collect cases / how-to-use\" item wrapping a bounded decision is a conflation; if its perpetual axis is already owned by a currency-watch program, resolve+fold the watch there — don't keep a dormant card or mint a parallel program;"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 43c66fb0-483f-42c1-bfbc-a1cd355f875c
---

A backlog item shaped as a **standing experience-collection home** (a Cases log + a "how to use this
item" instruction) that actually wraps a single bounded decision is a **conflation** — the same family as
[[feedback_no_decision_epic_conflation]] and [[feedback_map_item_is_not_a_blocker]]. Run the strict
[[backlog-workflow Program Test]] (#1249) to split it:

- The **perpetual part** ("X keeps needing new options forever") is a *currency front*. Before treating it
  as grounds for a new program, check whether an **existing currency-watch program already owns that
  external signal** (platform-standards #1257 / framework-churn #1258 / model-capability #1259 /
  library-adapter #1451). If so, **fold the watch into that program's Front-B scope** rather than minting a
  parallel program — a second watch on the same signal is a third wheel.
- The **bounded part** (the actual fork) is a *decision*. If it's already provisionally ruled, **resolve**
  the item (decisions don't soft-park; [[feedback_soft_deferred_parks_retired]]) and let the owning watch
  **mint the decision fresh on evidence** ([[feedback_discovery_output_is_cards_only]]) — don't pre-allocate
  a dormant placeholder card.

**Key discriminator:** adding a new enum value to an existing catalog param (e.g. `svelte-wrapper` to a
`form` value-set) is **catalog maintenance**, not contract evolution — it does NOT make the contract a
program. A program is justified only when the *contract shape itself* needs perpetual guarding.

**Why:** a principle captured only inside the item that surfaced it reads as "saved" (file exists, gate
green) but is invisible to a future session weighing a *different* "should this be a program?" call.

**How to apply:** when an item is a watch-log wrapping a decision, (1) Program-Test it, (2) fold the
currency duty into the existing watch's scope, (3) resolve the decision (or re-open only on real evidence),
(4) repoint any `blockedBy` that pointed at the old item to a `maturityGated` park on the watch firing.
Worked example: #978 (MaaS wrapper-serve "deferred experience review") → folded into #1258, #999 repointed.
