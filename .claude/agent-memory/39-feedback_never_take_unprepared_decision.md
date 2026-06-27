---
name: feedback-never-take-unprepared-decision
description: "never propose/rule on or \"accept to take\" an unprepared decision; preparedness is a precondition for /next decision — an unprepared one routes to /prepare, even when named directly"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 4f230718-1586-416b-a41d-ac8b0d1b0285
---

Preparedness is a **precondition** for making a decision, not something to discover mid-ruling. Never
*propose a ruling on* — and never *accept to take/select* — a `kind: decision` item that lacks
`preparedDate` (+ research/forks/concrete-refs at DoR). This holds **even when the user names the item
directly** via `/next <NNN>`: a direct name is "work it", not "rule it cold".

**Why:** ruling on an un-prepared fork lands the red-team attack at decision time instead of prep time;
the call becomes cold research masquerading as ratification. The two turns are distinct — prep (autonomous,
no judgment) then ratify.

**How to apply:** when `/next` surfaces or is pointed at a decision, screen `preparedDate` FIRST. If null:
do NOT present a proposed ruling and do NOT claim it as a decision-to-make. Route to `/prepare` (the
legitimate handling — it brings forks to DoR without making the call) or pick a prepared/dev-ready item
instead. Get an explicit go before burning prep tokens. Surfaced on #1457 (de-buried from #1442, no prep) —
I jumped straight to a PENDING-RATIFICATION ruling; user: "this decision does not look prepared … we should
not propose or accept to take unprepared decision." Relates to [[feedback_decision_go_is_not_whole_arc]],
[[feedback_remediate_before_escalate]], [[feedback_decisions_are_workitems_not_plan_mode]].
