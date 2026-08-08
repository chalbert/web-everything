---
bornAs: xaf0xg4
kind: decision
size: 3
status: open
dateOpened: "2026-08-07"
preparedDate: "2026-08-07"
tags: [agent-memory, learnings, conveyor, governance]
---

# Rule how a learning is admitted to agent memory: verify the note, rank by recurrence, block on nobody

The harvest exists to **consolidate and prioritize**, not to gatekeep. #1068 gave it a gatekeeping job it
cannot do: it replaced the close's "did this actually happen?" check with a recurrence count, because the
transcript was assumed gone. It is not gone. This rules what admits a note to memory (verified grounding),
what recurrence is for (ranking, never a gate), whether a pool entry may carry the evidence (yes — the schema
is minimal for a channel nobody built), and what fires the harvest (a cadence, not a person). No human stands
in the path.

## What forced this

#1068 split collection from adjudication for three sound reasons (a subagent cannot run a close; an unclosed
session loses everything; one session cannot judge recurrence). Moving judgment later was right. What went
wrong is what got dropped in the move.

The close's red-team had a **faithfulness** filter: a candidate had to quote the grounding turn from the
transcript or be rejected. The harvest has no transcript — so the filter was silently replaced by a
**recurrence** count. Nothing in the change recorded that a filter had been lost.

A bounded review of #1068 escalated at its round cap with every lens still at `changes`. A blind three-seat
design panel then falsified the premise all of it rested on, and the falsification is verifiable:

> **4,481 session transcript files exist under the harness project directory; 4,477 were modified within the
> last 30 days**, subagents included, with human turns marked as such.

Faithfulness was never structurally impossible. The judge moved across a seam and the evidence was left
behind.

Two further facts the same review established:

- **Recurrence cannot authenticate.** `session` and `ts` are written by the emitter, and any local process can
  append to the pool directly, bypassing the emit helper. Four hand-written lines manufacture "2 sessions
  across 2 days" in one second. Counting is a fine *relevance* signal and a worthless *integrity* one.
- **The recurrence bar structurally excludes one-off user directives** — a thing said once never recurs. That
  is how essentially the entire existing `feedback_*` corpus was created, including the ratified rule this
  decision must comply with.

## The governing intent

Stated by the operator, 2026-08-07: *the idea is mostly to consolidate and prioritize in a non-blocking way.*

That is the frame every fork below resolves against. The harvest's job is to fold many near-duplicate notes
into one and to surface what matters first. It is not an authentication checkpoint, and nothing waits on a
person. This is the same shape `we:agent-memory-src/autonomous-loops-non-blocking-red-team-not-prompts.md`
already ratified: the red-team is the reviewer, the change auto-lands, human oversight is retrospective.

## Fork 1 — what admits a note to agent memory?

- **(a) Verified grounding — the note carries the quoted turn plus a pointer to the transcript, and the
  harvest checks it. BOLD DEFAULT.** This restores the filter that was lost rather than substituting for it,
  and it checks against a file the harness writes, not one the emitter controls. A note that cannot be tied
  to a real moment routes to `we:backlog/` — never to memory.
- (b) A recurrence threshold. Rejected: it authenticates nothing, and it excludes the single most valuable
  source (a user saying something once).
- (c) A human approval step. Rejected: it reverses a ratified directive whose own grounding case was this
  exact pipeline, and it is the blocking gate the operator has refused three times.

## Fork 2 — what is recurrence for, then?

- **(a) A ranking key only. BOLD DEFAULT.** It answers "which of these should be looked at first", which is
  exactly the prioritize half of the intent. It never decides admission, so forging it buys an attacker
  nothing but queue position.
- (b) Keep it as a gate with a higher bar. Rejected — a higher bar on a forgeable number is still forgeable,
  and it deepens the one-off exclusion.

## Fork 3 — may a pool entry carry the evidence?

Today the entry is capped at 240/60/400 characters behind an allow-list. That minimality is justified in the
code by exactly one thing: the multi-tenant product feedback channel of #2610 — **which does not exist**.

- **(a) Relax the schema now; carry the quoted turn and the transcript pointer. BOLD DEFAULT.** Single-tenant
  today, so the constraint is anticipatory. Relaxing it collapses the whole design: with the evidence in the
  entry there is no need for hash receipts, digests, or attestation machinery — the harvest reads the quote
  and checks it. The migration cost when #2610 lands is small, because the pool is untracked local state that
  drains at every harvest.
- (b) Keep the schema minimal and store only a digest. Rejected: it buys nothing today and forces an elaborate
  receipt apparatus whose only purpose is to avoid storing a string.

**Constraint that does not move:** the always-loaded index has a hard size cap that is *not* a privacy
policy — the harness silently truncates it, so a bloated index drops rules with no warning. Nothing in this
fork touches it. Individual recall-gated note files are already unconstrained.

## Fork 4 — what fires the harvest?

- **(a) A cadence — a schedule, or a depth/age threshold the conveyor tick already evaluates. BOLD DEFAULT.**
  Already filed as #x5nbg4n.
- (b) A human typing the command. Rejected: an automatic pipeline whose trigger is a person is still blocking,
  just relocated.

## Open call

Ratify Fork 1(a), Fork 2(a), Fork 3(a), Fork 4(a) as one coherent design, or say which one is wrong. They are
separable in principle but 1(a) is what makes 2(a) safe, and 3(a) is what makes 1(a) cheap.

## Consequences for #1068

Ratifying the defaults **shrinks** #1068 rather than fixing it. The recurrence machinery is largely deleted,
not repaired: the sessions/days corroboration axes stay as ranking inputs, while the admission floor, the
`--min-sessions` gate semantics, and the skill prose defending them all go. The branch is also 29 commits
behind `main` and needs a rebase before any of that is worth doing.

## Non-goals

- **Does not close the failure class that convened all of this.** A filter *weakened or replaced in place*
  rather than deleted is still caught by nothing — no guard fires when an implementation quietly starts
  returning pass. That is the original hole and it needs its own item.
- Does not change the pool location, the archive semantics, or the concurrency work already done in #1068.
- Does not settle whether the closing-session skill is machine-wide or repo-scoped — separate, still open.
- Does not build #2610. It defers to it, and records the migration as accepted cost.
