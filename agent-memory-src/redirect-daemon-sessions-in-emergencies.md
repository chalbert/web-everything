---
name: redirect-daemon-sessions-in-emergencies
description: In an emergency the orchestrator may message a running daemon session to stop or reorient it (relaying the operator's decision); course-correction of live sessions is a wanted capability, not a breach.
metadata:
  type: feedback
---

When a running daemon session (a fixer, CI-heal, builder session) is doing work that a newer operator decision has made wrong or wasteful, the orchestrator may message it directly (cross-session `SendMessage`) to stop or reorient — stating plainly that it relays the operator's decision and what exactly to do instead. Pause the orchestrator's own competing job meanwhile, so two workers never act on the same PR.

**Why:** operator, 2026-10-01 ~3:55 PM ET, after the orchestrator relayed "split #3311" to the live fix-3311 session instead of waiting for it to finish obsolete work: "When emergency, it's ok to tell daemon session to stop or reorient — actually I would not see that as a bad thing; eventually we will allow user or automated supervisor to redirect and course-correct ongoing sessions."

**How to apply:** use it for emergencies and for sessions working against a newer decision; never to grant an approval (an agent message still cannot grant approval). Prefer it over letting a session burn tokens on discarded work. The long-term product is a supervisor/user course-correction feature for live sessions. Related: [[failure-is-a-product-improvement]], [[attribute-the-real-author]].
