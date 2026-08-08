---
bornAs: xaf0xg4
kind: decision
size: 3
status: resolved
dateOpened: "2026-08-07"
dateStarted: "2026-08-08"
dateResolved: "2026-08-08"
codifiedIn: "docs/agent/platform-decisions.md#memory-admission-verified-grounding"
preparedDate: "2026-08-07"
tags: [agent-memory, learnings, conveyor, governance]
---

# Rule how a learning is admitted to agent memory: verify the note, rank by recurrence, block on nobody

The harvest exists to **consolidate and prioritize**, not to gatekeep. #1068 gave it a gatekeeping job it
cannot do: it replaced the close's "did this actually happen?" check with a recurrence count, because the
transcript was assumed gone. It is not gone. This rules what admits a note to memory (**verified grounding**),
what recurrence is for (**diagnosis and ranking**, never a gate), whether a pool entry may carry the evidence
(yes, and **uncapped** while single-tenant), and what fires the harvest (a cadence **and** the manual
command). No human stands in the path.

## Ruling (ratified 2026-08-08)

All four forks ratified at their bold defaults, with four refinements folded during the discussion. Each
refinement is written into its fork below; this block is the summary, not the source.

- **Fork 1 — what admits a note: (a) VERIFIED GROUNDING. RATIFIED.** A note reaches agent memory only if it
  carries the quoted grounding turn plus a transcript pointer, and the harvest confirms the quote is really in
  that file. A note that cannot be tied to a real moment routes to `we:backlog/`, never to memory. *Amendment
  folded:* grounding proves the **moment**, not the **merit** — admission is "grounded **and** survives the
  red-team", never grounding alone.
- **Fork 2 — what recurrence is for: RANKING **and DIAGNOSIS**, never a gate. RATIFIED with a widened scope.**
  The prepared default said "a ranking key only". The decider widened it: recurrence is the signal that N notes
  are **symptoms of one cause**, so a cluster's output is a design-level story naming that cause, not N patches
  on a faulty design. Ranking falls out of the same count. The `--min-sessions` floor is **deleted** — a
  one-session cluster is still a real signal, it merely sorts lower.
- **Fork 3 — may a pool entry carry the evidence: (a) YES, and UNCAPPED. RATIFIED with a widened scope.** The
  prepared default relaxed the schema; the decider removed the caps outright for the single-tenant case ("save
  all relevant info"). *Amendment folded:* the secret scrub **relocates rather than dies** — it moves from the
  append seam to the **publish seam**, because the pool is untracked local state but harvest *output* is
  committed and pushed. Per-cluster excerpting becomes a harvest **context budget**, not a schema cap.
- **Fork 4 — what fires the harvest: (a) A CADENCE, plus the manual command. RATIFIED, lowest priority.**
  Automatic firing is the settled end state; it is a **sequencing** call, not a merit one, and nothing else in
  this ruling depends on it. `/harvest` stays available as a manual trigger, and the two share one lock so a
  tick and a manual run cannot double-file. *Amendment folded:* a harvest **may defer a cluster** whose cause is
  not yet clear, leaving it for a later run with more evidence.

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

- **(a) RULED — verified grounding: the note carries the quoted turn plus a pointer to the transcript, and the
  harvest checks it.** This restores the filter that was lost rather than substituting for it,
  and it checks against a file the harness writes, not one the emitter controls. A note that cannot be tied
  to a real moment routes to `we:backlog/` — never to memory.
  - **Amendment folded — grounding proves the moment, not the merit.** A verified quote establishes that the
    turn happened; it does not establish that the lesson drawn from it is right. An agent can quote a real turn
    and hang a self-serving conclusion on it. So the admission rule reads **grounded *and* survives the
    red-team**, never grounding alone — the red-team stays the merit check it already was.
  - **Open risk — what if the transcript is gone?** The falsification proves transcripts exist *now* (4,477 of
    4,481 modified within 30 days), not that they are retained. If the harness prunes them or the user clears
    them, every note fails verification and routes silently to `we:backlog/` — memory quietly stops being
    written and nothing says so. Fail-safe is the right direction, but the silence is not: a harvest whose
    verification failure rate crosses a threshold must raise an alarm, not reroute quietly. Filed as a
    successor item.
- (b) A recurrence threshold. Rejected: it authenticates nothing, and it excludes the single most valuable
  source (a user saying something once).
- (c) A human approval step. Rejected: it reverses a ratified directive whose own grounding case was this
  exact pipeline, and it is the blocking gate the operator has refused three times.

## Fork 2 — what is recurrence for, then?

- **(a) RULED — a diagnostic signal first, a ranking key second. Never admission.** ~~A ranking key only.~~
  The prepared default stopped at ranking; the ruling widens it. Recurrence answers *"which of these should be
  looked at first"* (prioritize), **and** the more valuable question: *"are these five notes five problems, or
  five symptoms of one?"* A cluster is evidence of a common cause, so the harvest's output for a cluster is a
  **story that addresses the cause**, not N patches on top of a faulty design. Either way it never decides
  admission, so forging it buys an attacker nothing but queue position.
- (b) Keep it as a gate with a higher bar. Rejected — a higher bar on a forgeable number is still forgeable,
  and it deepens the one-off exclusion.

**What this changes in the built code.** The clustering half already exists and is kept:
`we:scripts/conveyor/learnings-dedup.mjs` groups by `kind` + normalized `area` + summary Jaccard under
complete-link agglomeration, and `we:scripts/conveyor/learnings-harvest.mjs:136-146` ranks clusters by distinct
sessions then raw count. Three things change:

- **A cluster's output is a synthesized cause, not an elected member.** Today each cluster emits a
  *representative* — "the longest/most-specific summary". That elects the best-described **symptom**. The
  cluster must instead reach the harvest with all its members (and, per Fork 3, their quoted turns) so the
  synthesis can name what is actually wrong.
- **Two destinations, not one.** A single grounded note → an agent-memory rule. A cluster of N → a
  `we:backlog/` story about the design. Those are different artifacts and must not share one slot.
- **The `--min-sessions` floor is deleted.** It currently filters clusters below the bar into `belowFloor` and
  out of the candidate list. Under this ruling a one-session cluster is a real signal that sorts lower; hiding
  it discards exactly the one-off directive Fork 1 exists to protect.

*Worked example.* Five notes across four sessions: "gate slow on a docs change" · "suite re-ran for a comment
fix" · "lane gate timed out on a README edit" · "3 min wasted on a typo fix" · "gate ignores what I touched".
Today the harvest files the longest of those. Under this ruling it files one story — *the lane gate has no
file-family scoping* — with the five moments attached as evidence.

## Fork 3 — may a pool entry carry the evidence?

Today the entry is capped at 240/60/400 characters behind a four-key allow-list
(`we:scripts/conveyor/learnings-drop.mjs:50-56`). The cap serves two stated purposes: the multi-tenant product
feedback channel of #2610 — **which does not exist** — and a structural leak-class kill (a PEM key or a pasted
file physically cannot fit in 240 characters).

- **(a) RULED — carry the quoted turn and the transcript pointer, and do not cap them.** ~~Relax the
  schema.~~ The prepared default relaxed the caps; the ruling removes them for the single-tenant case. The
  decider's ground: *"I don't see why we should limit the quantity of data collected for now — eventually if we
  run on all users, maybe, but for me as a local user we should save all relevant info."* Storing the full
  context beats storing a digest and hoping it can be reconstructed. This also collapses the rest of the design:
  with the evidence in the entry there is no need for hash receipts or attestation machinery — the harvest reads
  the quote and checks it. And per Fork 2 it is what makes cause-synthesis possible at all: a root cause cannot
  be diagnosed from `count: 5`.
- (b) Keep the schema minimal and store only a digest. Rejected: it buys nothing today and forces an elaborate
  receipt apparatus whose only purpose is to avoid storing a string.

**Amendment folded — the scrub relocates, it does not die.** Removing the caps also removes the leak-class
defense and the reject-absolute-paths rule, and a quoted turn is precisely a raw blob of whatever was on
screen. The resolution is that the check belongs at the **exit**, not the entrance. The pool lives at
`~/.claude/conveyor/learnings`, outside any checkout and untracked, so a secret sitting there never leaves the
machine; but harvest **output** becomes backlog items and memory files that are committed and pushed. So the
secret/entropy scan moves from the append seam to the **publish seam**. Filed as a successor item.

**Amendment folded — size is a context problem, not a storage problem.** Unlimited on disk is free; the harvest
reading eight 3,000-character quotes into model context for one candidate is not. The limit therefore belongs
on *what the harvest sends per cluster* — full quotes stored, excerpts sent, with the pointer available to open
the full turn when the synthesis needs it. That is a harvest-side budget, never a schema cap.

**Correction to the original reasoning.** This fork previously argued the #2610 migration cost was small
"because the pool is untracked local state that drains at every harvest". Fork 4's deferral amendment makes
that false — a deferred cluster survives a harvest by design. The conclusion is unchanged (the pool is still
local, still bounded by archiving), but the drains-every-harvest premise must not be relied on.

**Constraint that does not move:** the always-loaded index has a hard size cap that is *not* a privacy
policy — the harness silently truncates it, so a bloated index drops rules with no warning. Nothing in this
fork touches it. Individual recall-gated note files are already unconstrained.

## Fork 4 — what fires the harvest?

- **(a) RULED — a cadence, plus the manual command; lowest priority of the four.** A schedule, or a depth/age
  threshold the conveyor tick already evaluates. Filed as #3014. The hook point exists:
  `we:scripts/conveyor/tick-core.mjs` is the tick, and `poolStatus()`
  (`we:scripts/conveyor/learnings-harvest.mjs:173-182`) already returns the depth and age numbers a threshold
  would read — this is wiring, not new machinery. *Decider's framing, folded:* automatic firing is the
  absolutely-intended end state, so this is **a priority point rather than a merit one** — nothing else in the
  ruling depends on it, so it lands last.
- (b) A human typing the command *as the only trigger*. Rejected: an automatic pipeline whose trigger is a
  person is still blocking, just relocated.

**Amendment folded — the manual trigger is kept, not replaced.** `/harvest`
(`we:.claude/commands/harvest.md`, the `harvest-learnings` skill) stays available and supported. The fork was
only ever about the trigger *of record*. Consequence: a scheduled tick and a manual run must not overlap and
double-file the same clusters, so they share **one lock** — the same singleton pattern the conveyor runner
already uses.

**Amendment folded — a harvest need not drain the whole pool.** Decider: *"harvest should not always harvest
all notes; some may be left in the pool if the cause is not yet clear."* This is not expressible today —
archiving is per **file**, not per note (`archivePool` in
`we:scripts/conveyor/learnings-harvest.mjs:202-241` moves whole session `.jsonl` files into
`harvested/<stamp>/`, and archived entries are unrecoverable by any future harvest), while one session file
mixes acted-on and deferred notes. The resolution keeps the append-only design intact: **archive as today, then
re-emit the deferred clusters as a fresh pool file** (`deferred-<stamp>.jsonl`) — no in-place rewrite, so the
concurrent-append hazard the mandatory archive bound guards against never arises. Two riders:

- **The deferral count is itself a signal.** A cluster deferred five times is not unclear, it is chronic — that
  should surface as its own finding, which is Fork 2's rule applied to the harvest's own output.
- **The reason for deferring is written down.** Otherwise every harvest re-derives "hmm, unclear" from scratch
  and the pool grows a permanent sediment layer.

Filed as a successor item.

## Open call — SETTLED 2026-08-08

~~Ratify Fork 1(a), Fork 2(a), Fork 3(a), Fork 4(a) as one coherent design, or say which one is wrong.~~
**All four ratified at their defaults**, two of them with widened scope (Fork 2 gains diagnosis, Fork 3 drops
the caps outright) and four amendments folded. See *Ruling*, above. The coupling held as predicted: 1(a) is
what makes 2(a) safe, 3(a) is what makes 1(a) cheap — and the discussion added a third edge, that 3(a) is what
makes Fork 2's cause-synthesis possible at all.

## Consequences for #1068

The ruling **shrinks** #1068 rather than fixing it. The recurrence machinery is largely deleted,
not repaired: the sessions/days corroboration axes stay as ranking inputs, while the admission floor, the
`--min-sessions` gate semantics, and the skill prose defending them all go. The branch is also 29 commits
behind `main` and needs a rebase before any of that is worth doing.

## Non-goals

- **Does not close the failure class that convened all of this.** A filter *weakened or replaced in place*
  rather than deleted is still caught by nothing — no guard fires when an implementation quietly starts
  returning pass. That is the original hole and it needs its own item.
- Does not change the pool location or the concurrency work already done in #1068. It **does** extend the
  archive semantics — Fork 4's deferral amendment adds a re-emit step after archiving — but leaves the
  mandatory archive bound and the per-file move itself untouched.
- Does not settle whether the closing-session skill is machine-wide or repo-scoped — separate, still open.
- Does not build #2610. It defers to it, and records the migration as accepted cost.
