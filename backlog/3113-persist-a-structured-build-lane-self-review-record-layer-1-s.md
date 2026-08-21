---
bornAs: x55v5xy
kind: story
size: 3
parent: "2527"
status: open
dateOpened: "2026-08-15"
tags: []
---

# Persist a structured build-lane self-review record (Layer 1) so it can be traced

Layer-1 build-time self-review (#2672/#2828) runs entirely in-session with nothing written to disk — the delivery-agent-brief screenshots, reads, and iterates, then opens the PR with no durable trace. #2818's per-item pipeline timeline can only surface a self-review stage once one exists to surface. Decide where it persists (a new event log mirroring we:scripts/lib/jury-ledger.mjs's pattern, vs. a lighter PR-comment marker) and wire the delivery-agent-brief to write it.

## Design

### The fork is real and this item owns it — but two constraints narrow it before anyone votes

**Constraint 1 — the jury-ledger's log directory is gitignored, per-clone state.** `juryLogDir`
(`we:scripts/lib/jury-ledger.mjs` ~L71) resolves to `<root>/.conveyor/jury`, and `we:.gitignore` L71 excludes
`.conveyor/jury/`. A delivery agent runs in a **lane-pool clone** that is released and reused after the PR
opens, so a record written there is gone before anyone traces it. That does not kill the ledger arm — it means
the ledger arm must name a durable *destination* (the `CONVEYOR_JURY_DIR` override points elsewhere; or the
record is emitted from the lane and appended by a host that outlives it). Any design that says "write it to
the jury ledger" and stops there has not solved the problem the item is filed for.

**Constraint 2 — #2818's consumer is already built, and it dictates the shape.** The item says #2818's
timeline "can only surface a self-review stage once one exists". #2818 is still `status: open`, but its task-1
artifact **has landed**: `we:scripts/lib/pipeline-trace.mjs` exists, with `normalizeStep(raw)` (~L50, the ONE
`Step` shape), `reviewStepFromLedger(events)` (~L84), `escalationStepFromReviewDetail(detail)` (~L118) and
`landStepFromHistoryEntries(entries)` (~L149). There is **no** self-review step builder. So the deliverable is
concretely: a `selfReviewStepFrom…` sibling in that module, plus whatever writer feeds it. Whatever the fork
picks, the record must fold into `normalizeStep`'s existing `Step` shape (`name`, `status`, `verdict`,
`reasons`, `careLevel?`, `rounds?`, `actor`, `startedAt`, `endedAt`, `detail?`) — a parallel shape is the
same duplication `we:scripts/lib/pipeline-trace.mjs`'s own header rules out.

### The two arms, with what each already gives you

- **(a) jury-ledger events.** `buildReviewLedgerEvents({ activeLenses, lensVerdicts, findings, rounds,
  reviewedSha })` (`we:scripts/lib/jury-ledger.mjs` ~L173) already builds a schema-valid stream from exactly
  the state a self-review produces, and the `record` subcommand (~L539) is a ready CLI seam — the
  `review-parked-prs` recorder agent already shells it, so no event construction happens in a prompt. And
  `reviewStepFromLedger` already folds such a stream into a `Step` with `rounds`, `verdict` and a timestamp
  span. Cost: constraint 1, plus the subject-key question (a jury log is one file per subject and the schema
  carries no subject field — a build-lane self-review and the later PR review of the same PR would collide on
  one key unless they are keyed apart).
- **(b) a lighter PR-comment marker.** Durable by construction (it lives on the PR, which outlives the lane)
  and needs no new store. Cost: it is prose in a comment, so the parser is the new surface, and the record is
  only as structured as the marker format; and the brief already has a "write something durable at the end"
  step to model it on — step 9's learnings drop (`we:scripts/conveyor/learnings-drop.mjs`), whose write-time
  scrub REJECTS code, diffs, paths and repo names. A self-review record is mostly findings about code, so that
  precedent's privacy posture does **not** transfer; note that rather than reuse it by reflex.

### The writer

Whatever wins, the write is wired into step 6 of `we:skills-src/conveyor/delivery-agent-brief.md` — the same
step #2969 is rewriting onto `/converge`. **Sequence these two deliberately**: if #2969 lands first, step 6
already produces a structured round history and dismissal trail (`we:scripts/converge-cli.mjs`'s persisted
state), and this item becomes "persist what the loop already produced" rather than "invent a record from
in-session prose". Landing this first means designing a record shape against prose that is about to be
replaced. Check #2969's status before starting.

## Done when

The arm chosen for the persistence fork is stated on this item, with the reason, **before** any code lands —
that ruling is the item's first deliverable and criteria 1–4 are written to hold under either arm.

1. `npx vitest run pipeline-trace` fails before and passes after, covering a new self-review `Step` builder in
   `we:scripts/lib/pipeline-trace.mjs`: a well-formed record folds to a `Step` with a non-`unknown` `status`
   and a `verdict`; a malformed / missing record degrades to `status: 'unknown'` rather than throwing (the
   module's stated never-throw contract). (Tier 1.)
2. A round-trip test: the writer's output, fed straight back to the reader, reproduces the same `Step` — no
   hand-built fixture standing in for what the writer actually emits. This is what stops the record and its
   consumer from being designed against two different shapes. (Tier 1.)
3. After a real (or scripted) delivery-lane run, the record is readable **from outside that lane clone** by
   one named command, and the command is written on this item. If the chosen store is per-clone and
   gitignored, this criterion fails — which is the point: it is the check that the record survives lane
   recycling. (Tier 2.)
4. The record carries, at minimum, the fields `we:scripts/lib/pipeline-trace.mjs`'s `Step` already declares
   as meaningful for a review stage — `verdict`, `rounds`, `startedAt`/`endedAt` — so #2818's timeline can
   render it without a second normalizer. One read of the emitted record. (Tier 2.)
5. Nothing in step 6 of `we:skills-src/conveyor/delivery-agent-brief.md` gates PR-open on the record being
   written: a failed write is reported, never a stop. (Tier 3 — read the step-6 block.)
