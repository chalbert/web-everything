---
name: feedback_poc_mode_pragmatism
description: "In POC mode, don't rat-hole on implementation details — pick a sensible default, go with the recommendation, keep moving toward a demonstrable concept"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: b9e07701-b0aa-444b-9587-b06189a821a3
---

When the user is in POC/prototype mode, implementation-detail choices (which parser/library, module format, exact build wiring) are NOT critical. Pick a reasonable default, state it in one line, and keep moving toward a demonstrable working concept. The user said repeatedly "implementation details not critical in poc mode" and "go with your recommendation / with your recommendation."

**Why:** Deep infra deliberation stalls momentum; in POC the goal is a working concept to react to, not a perfected architecture.

**How to apply:**
- For a POC, take the path of least resistance on infra, name the choice in one line, and proceed; reserve architecture deliberation (parser, deps, perf, module format) for when it graduates out of POC.
- Defer non-critical plumbing as an explicit, named follow-up (a backlog item) instead of blocking on it.
- Offer a recommendation and act on it unless told otherwise; don't surface every infra fork as a decision.
- Pairs with [[feedback_demo_first_iteration]] and [[feedback_self_contained_plans]].
