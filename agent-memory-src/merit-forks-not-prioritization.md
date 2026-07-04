---
name: merit-forks-not-prioritization
description: "Decision forks must be merit-based (resolved by a principle), not prioritization/YAGNI/timing calls"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: ff94edd2-ef48-4f66-9d45-2794654f0dbc
---

A fork in a decision item must be **merit-based**: resolved by a *principle* (which
mechanism is correct / free / statute-honoring). A "do it now vs. defer" / YAGNI /
timing question is a **prioritization call**, not a design fork — it is resolved by
sequencing, not merit — and must NOT be presented as a peer fork to ratify.

**Why:** the user is tired of non-merit-based forks cluttering decision items (raised on
#1961, where "ship a stable change event now?" was framed as Fork 2 alongside the real
merit fork). A scheduling question dressed as a fork inflates the decision and dilutes
the actual design call.

**How to apply:** when preparing/presenting a decision, keep only merit forks as forks.
Demote any timing/YAGNI/"not now" question to a recorded **deferral** — state the
settled design, note it's a prioritization call, and hang the concrete un-gate trip-wire
on the consuming/`blockedBy` item so it resurfaces as a real backlog item instead of
rotting as advisory prose. Applies to `/prepare` and `/next decision`.

Related: [[propose-standard-in-platform-shape]], [[naming-fork-precedent-discipline]].
