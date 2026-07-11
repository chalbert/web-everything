---
bornAs: xla8zta
kind: story
size: 3
parent: "2418"
status: resolved
dateOpened: "2026-07-11"
dateStarted: "2026-07-11"
dateResolved: "2026-07-11"
graduatedTo: none
tags: []
---

# closing-session: standing efficiency-introspection step (all session types)

Add a standing step to the closing-session skill: every close, after the safety/health audit, scan the session transcript for (a) main-loop steps that should have been delegated and (b) ad-hoc command sequences that should be scripted, and emit a bounded, evidence-based proposals table. Skips trivial sessions. This is the meta that keeps surfacing slices A–E for future session types. Source: the drain-session efficiency introspection (2026-07-10).

## Resolution
Replaced the closing-session skill's step 3a ("Model-usage suggestion", gated on the project having a
we:docs/agent/backlog-workflow.md model-routing doc) with a generalized "Efficiency-introspection" step
that fires on **every non-trivial session, any session type**: it scans for (a) main-loop steps that
should have been delegated (a superset of the old model-usage check) and (b) ad-hoc command sequences
hand-repeated that should be scripted, and emits a bounded (max 5 rows) evidence-based table instead of
free-form prose. Trivial sessions skip the step entirely. The verdict template's `Model usage` field was
renamed `Efficiency` to match. See we:skills-src/closing-session/SKILL.md §3a.
