---
name: feedback-never-take-unprepared-decision
description: "never propose/rule on, present for the user's pick, or \"accept to take\" an unprepared decision or decision-shaped fork — applies to kind:decision items via /next AND to any story/task whose body embeds an un-prepared fork surfaced in chat"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 4f230718-1586-416b-a41d-ac8b0d1b0285
---

Preparedness is a **precondition** for making a decision, not something to discover mid-ruling. Never
*propose a ruling on* — and never *accept to take/select* — a `kind: decision` item that lacks
`preparedDate` (+ research/forks/concrete-refs at DoR). This holds **even when the user names the item
directly** via `/next <NNN>`: a direct name is "work it", not "rule it cold". It also holds for a
**non-`decision`-kind item that embeds a decision-shaped fork** (e.g. a `story` whose "Done when" says
"pick option (a) or (b) and record why") — laying out that fork's options/tradeoffs/recommendation in chat
for the user to pick between **is presenting a decision**, whether or not the card's `kind:` says so and
whether or not `preparedDate` even applies to that kind. The forbidden move is the presentation itself, not
just the ratification.

**Why:** ruling on an un-prepared fork lands the red-team attack at decision time instead of prep time;
the call becomes cold research masquerading as ratification. The two turns are distinct — prep (autonomous,
no judgment) then ratify. Surfacing a fork informally in conversation skips prep just as much as surfacing
it via `/next` does — the channel doesn't matter, only whether the groundwork happened first.

**How to apply — the checkable test:** before laying out options/tradeoffs/a recommendation for the
user to pick between, ask (i) does the item body carry a **named fork** — an enumerated (a)/(b), or a
"Done when" clause that requires a call to be recorded — that is **anchored to a tracked backlog
item**? If no (an untracked, explicitly-informal exploration the user disclaims as such — "just
thinking out loud, don't file this" — isn't a presented decision), this rule doesn't bind. If yes, ask
(ii) has that fork already reached `kind: decision` + `preparedDate`? If (i) yes and (ii) no, do not
present it as a menu — split the remedy by case:
- **Already `kind: decision`:** screen `preparedDate` FIRST. If null, do NOT present a proposed
  ruling and do NOT claim it as a decision-to-make. Route to `/prepare` (the legitimate handling — it
  brings forks to DoR without making the call) or pick a prepared/dev-ready item instead. Get an
  explicit go before burning prep tokens.
- **Embedded in a non-decision item (story/task):** `/prepare` does not accept these — it builds its
  candidate set from `kind: decision`/`review` and stamps `preparedDate`, which does not apply here.
  **Carve first**, per [[feedback_decisions_are_workitems_not_plan_mode]]: split the fork out to its
  own `kind: decision` card, set the original's `blockedBy` on it, trim the original to a one-line
  pointer — *then* `/prepare` the carved card. Presenting the fork inline instead of carving it is the
  same violation as skipping `/prepare` on a real decision item.

The moment a fork is real enough to belong on a card, carve it rather than answering it inline —
regardless of how the user's question was phrased (an evaluative "do they add good value" is not
itself a request to be handed a pick-between-options menu). Surfaced twice:
(1) #1457 (de-buried from #1442, no prep) — I jumped straight to a PENDING-RATIFICATION ruling; user: "this
decision does not look prepared … we should not propose or accept to take unprepared decision."
(2) #3373 (a `kind: story`, no `preparedDate`, no `/prepare` run, "Done when" item 2 an explicit (a)/(b)
enforcement fork) — asked to assess whether it "added good value," I laid out its two options with
tradeoffs and a recommendation as if for the user to pick; user: "it should be forbidden to present an
unprepared decision." Relates to [[feedback_decision_go_is_not_whole_arc]],
[[feedback_remediate_before_escalate]], [[feedback_decisions_are_workitems_not_plan_mode]].
