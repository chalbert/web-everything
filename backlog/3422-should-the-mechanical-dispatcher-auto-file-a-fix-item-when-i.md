---
bornAs: xk7amte
kind: decision
parent: "3383"
status: resolved
dateOpened: "2026-08-31"
dateResolved: "2026-08-31"
relatedTo: ["3405", "3416"]
tags: [governance, conveyor, dispatch, self-improve]
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

## Ruling — 2026-08-31, Nicolas Gilbert

**Forks (a) and (b) collapse onto one axis: did the hiccup block delivery, or not.**

- **Blocking** — the dispatcher could not proceed (a real code defect like `#3416`'s guard-suppression bug,
  or a dispatched agent punting to free-form prose instead of a predefined structured response, like
  `conveyor-3412`'s stall) → auto-file the card **and** propose a fix, but the fix stays gated behind
  explicit human approval before it lands or queues for build. This is the higher-stakes bucket: a wrong
  auto-diagnosis here wastes a build cycle or lands something subtly wrong, and matches the operator's own
  "with some approval gate at first."
- **Non-blocking** — delivery succeeded but surfaced something worth improving (a perf finding, a rough
  edge, anything that did not stop the tick) → file the card only, no fix proposed, and it goes straight
  through with no gate. Filing a pure observation costs nothing but review attention on an already-cheap
  card, unlike queuing an unreviewed fix.

This is a narrower, purely mechanical risk axis than a general config of risk tiers — "did the tick actually
get blocked or suppressed" is already observable directly off the tick core's own state, so it needs no new
judgment call to compute, only a new trigger and a new sink. Widen to a richer risk config later if the
blocking/non-blocking split proves too coarse in practice; nothing here forecloses that.

**Item 2, answered directly: yes.** A dispatched agent's free-form uncertainty ("I'm not sure this is real
work," `conveyor-3412`'s own shape) is a BLOCKING hiccup — the tick did not proceed — and therefore sits in
the gated auto-file-and-propose-a-fix bucket, not the straight-through bucket. The "fix" a hiccup of this
specific shape proposes is typically to the agent's own brief/instructions (so it stops happening), not to
dispatcher code — still gated the same way, since a wrong diagnosis of *why* an agent stalled is exactly the
kind of mistake human review exists to catch before it's re-taught to every future dispatch.

**Fork (c): route through the existing learnings-pool/`/harvest` pipeline, not a parallel fast path.**
`/harvest` already does the "is this signal or noise, does a card already exist" judgment an auto-filer would
otherwise have to re-derive, and a second judgment pipeline risks the two disagreeing over time. The one
change from today: the dispatcher drops the entry into the pool **mechanically, at the moment of the
hiccup** — the same shape `we:skills-src/capture-learning` already writes by hand — rather than waiting for
someone to `/note` it at session end. For the blocking bucket, the pool entry additionally carries a proposed
fix and an explicit approval-pending flag the harvest pass (or a lighter-weight companion trigger) reads
before it's allowed to queue.

Codified nowhere new — this ruling shapes a not-yet-built mechanism rather than an active enforcement rule,
so it does not warrant its own `we:docs/agent/platform-decisions.md` entry the way `#3405`'s doctrine did.

## Done when

1. ~~A ruling is recorded here on (a)/(b)/(c).~~ **Done — see Ruling above.**
2. ~~Names, explicitly, whether a dispatched agent's own free-form uncertainty is a covered hiccup shape.~~
   **Done — see Ruling above: yes, blocking bucket.**
3. **Done — filed as `#3421`**, naming the concrete build scope (the blocking/non-blocking classifier off
   tick-core state, the learnings-pool mechanical-trigger sink, and the approval-gate read before a
   blocking-bucket fix queues).
