---
description: Bring an un-prepared open decision to "ready to ratify" — research + author its forks ahead of the call (routes to the prepare-decision-item skill)
---

Invoke the `prepare-decision-item` skill to do the **autonomous half** of an open decision: the
prior-art research + authoring that brings its forks to the *Definition of Ready*, with **no human
judgment yet**. Run the three documented passes (*Fork-readiness pass* → *Per-fork classification pass*
→ *The prepared-fork shape* in [docs/agent/backlog-workflow.md](../../docs/agent/backlog-workflow.md)):
survey prior art and **publish a `/research/` topic**, classify every element against the architecture,
then rewrite the item to the prepared-fork shape (grounding digest · axis-framing paragraph with
concrete `file:line` refs · "recommended path at a glance" table · one `## Fork N` per fork with options
+ a **bold** default). Then set **`preparedDate`**, gate on `npm run check:standards`, and **release the
claim back to `open`** — prep never `resolve`s the item; making the call is `/next decision`'s job.

A bare `/prepare` ranks the un-prepared open decisions (Tier-B `○ needs prep`, plus blocked decisions)
by downstream-unblock leverage, recommends one, and gets a single "go" before spending the research
budget. A `NNN` or `NNN-slug` focuses one item and goes straight in.

$ARGUMENTS
