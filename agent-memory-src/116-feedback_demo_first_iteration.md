---
name: feedback_demo_first_iteration
description: "Iterate on a standalone demo/sandbox page to refine an approach before bringing it into real block/'mock' pages"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: b9e07701-b0aa-444b-9587-b06189a821a3
---

Refine a new capability on a standalone demo/sandbox page first (a conformance "playground"), then port the matured pattern into real pages. The user said "we'll work from a demo page to improve before bringing into mock block."

**Why:** A sandbox surfaces bugs and design issues cheaply (e.g. it caught a renderer `.content` bug) before touching production block/adapter pages.

**How to apply:**
- For a new capability, build/extend a demo per `docs/agent/demo-workflow.md`, prove it there with a conformance harness (badges that name the invariant they prove), then roll it onto real pages.
- Drive demo logic from shared fixtures so the demo and its tests can't drift.
- Pairs with [[feedback_poc_mode_pragmatism]]; demos run on the live dev server, so [[feedback_dont_kill_dev_server]] applies.
