---
kind: decision
parent: "3383"
status: open
dateOpened: "2026-08-31"
tags: []
---

# Should the mechanical dispatcher auto-file a fix item when it hits a real delivery hiccup, gated by approval at first?

The learnings pool (~/.claude/conveyor/learnings/*.jsonl) already captures friction from every session, and /harvest later judges and routes survivors to backlog items -- but that is a periodic, human-triggered sweep, not the dispatcher itself noticing a hiccup mid-delivery and mechanically filing + queuing the fix right then. #3416 tonight is the concrete case this would have caught immediately rather than at the end of a long session's own write-up: a real, reproducible bug found while exercising the dispatcher live. The operator's own framing (2026-08-31): the system should be able to capture hiccups during delivery and mechanically create fix items and queue them to self-improve, with some approval gate at first rather than fully unattended. This is the same shape as the already-ratified #3405 doctrine (a dispatched agent that hits a gap halts and surfaces a missing-operation finding rather than working around it silently) generalized from ONE gap class (a missing operation) to delivery hiccups more broadly, and it needs the same kind of fork-based decision #3405 got rather than being built ad hoc: what counts as a hiccup worth auto-filing (a crash vs. a suppressed dispatch vs. a slow gate) versus noise not worth a card; whether the FIRST version gates every auto-filed item behind an explicit human approval before it is queued (matching the operator's own 'with some approval at first'), or only gates the riskier subset; and where this lives relative to the existing learnings-pool/harvest pipeline -- a parallel fast path for delivery-time hiccups specifically, or a new, more mechanical trigger into the SAME pool. Capture-only for now -- no build required to close it, mirroring #3049's own shape.

## A live instance, minutes after this card was filed — sharpens Fork (a), doesn't answer it

The `#3416` fix's own live-fire re-verification (same night) dispatched a real agent, `conveyor-3412`. It
stalled `blocked`/`idle`, and its own transcript gives the reason in plain prose: it read its starting cwd (a
scratch clone with unrelated, unrelated-to-it uncommitted work sitting in it), judged that this "isn't a fresh
lane… it reads like reference material… not a directive to act," and asked an open-ended question —
*"What would you like me to do here?"* — instead of proceeding or following any predefined recovery step.

**Checked directly, and the agent was WRONG.** Its own prompt (`we:skills-src/conveyor/delivery-agent-brief.md`,
read straight from the transcript) had every `{{PLACEHOLDER}}` correctly substituted — item `3412`, the real
backlog file, lane `4`, session slug `conveyor-3412`, the real `scope:` list — and an unambiguous "## Your job
(one sentence)" section. This was a genuine, real, fully-instantiated brief, not a template. The agent
misjudged its own input and then had nowhere to route that misjudgment except free-form prose to a person who
was not watching.

**Why this matters for THIS decision, not just as its own bug.** It is the operator's own point (2026-08-31):
*"mechanically launched agent must know to send back formatted JSON for some predefined action — open question
will not work."* A headless dispatch has no one to correct a wrong judgment call in real time — the SAME
argument `#3405`'s Fork 2 already made for a missing-operation gap ("a dispatched agent has no person watching
it turn-by-turn… silently blocking or working around a gap is worse here than for an interactive session")
applies with equal force to "I'm not sure this is real work": the failure mode is not merely doing nothing, it
is doing nothing while asserting something false, unreadable by anything downstream that isn't a person parsing
prose. This does not by itself answer Fork (a)/(b)/(c) below, but it is concrete evidence that "the dispatched
agent decides to ask a free-form question" is itself a hiccup shape this decision needs to cover, not a
hypothetical.

## Done when

1. A ruling is recorded here on: (a) what counts as an auto-filable hiccup vs. noise, (b) whether every
   auto-filed item is gated behind human approval before it queues, or only a riskier subset, and (c) whether
   this is a new fast path or a new trigger into the existing learnings-pool/`/harvest` pipeline.
2. Names, explicitly, whether a dispatched agent's own free-form uncertainty ("I'm not sure this is real work")
   is itself one of the hiccup shapes this decision's ruling covers — the live `conveyor-3412` instance above is
   real evidence it needs an answer, not a hypothetical to defer.
3. If the ruling calls for building anything, a follow-up story is filed under this card naming the concrete
   scope — this decision itself stays capture-only, mirroring `#3049`.
