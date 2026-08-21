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

### The writer — it is step 7, NOT step 6

The stage with nothing on disk is **step 7**, *"Visual self-review — render the surface, READ the screenshot,
diff it against the baseline (UI-locus items ONLY)"* (`we:skills-src/conveyor/delivery-agent-brief.md`
~L182–210). That is what this card's own opening describes (*"screenshots, reads, and iterates"*), what its
own citations are about (#2672 = *"Build-time visual self-review for UI items"*, #2828 = the UI-fidelity
self-review scope ruling), and what #2818 — the item that filed this one as its prerequisite — names in as
many words: *"Layer-1 build-time self-review (`we:skills-src/conveyor/delivery-agent-brief.md`, step 7, lines
166–192) runs entirely in-session — render, screenshot, Read, iterate — and writes nothing to disk."*

Step **6** is the adversarial CODE review, and it belongs to #2969. Wiring the record there would satisfy
criteria 1 and 2 against whatever step 6 emits while leaving #2818's timeline with nothing to fold for the
visual stage — work that reads as done and is not. (An earlier draft of this Design said step 6; corrected
2026-08-21 by the independent review.)

**Sequencing against #2969, which is still real.** #2969 rewrites step 6 onto `/converge`, which will make
step 6 produce a structured round history and dismissal trail (`we:scripts/converge-cli.mjs`'s persisted
state) for free. If a *code*-review record is also wanted, that is #2969's byproduct and should be taken from
there rather than invented here. This card's own target stays step 7. Check #2969's status before starting so
the two do not design two different record shapes.

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
5. Nothing in step 7 of `we:skills-src/conveyor/delivery-agent-brief.md` gates PR-open on the record being
   written — **and a failed write lands somewhere durable**, named on this item (the PR body, or the run's
   escalation path), not only in an agent transcript. A best-effort write whose failure is invisible
   recreates the exact durability problem Constraint 1 says the item exists to solve. (Tier 3 for the
   non-gating half — read the step-7 block; Tier 2 for the durable-report half — name the artifact and read
   it after a run.)

## Independent review — 2026-08-21

Confidence: **Medium**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (addressed; strategy: verify by mutation or reversion up front) — The card verifies its premises against the live repo rather than assuming: it confirms we:scripts/lib/jury-ledger.mjs's juryLogDir (L71), we:.gitignore's .conveyor/jury/ exclusion (L71), and that we:scripts/lib/pipeline-trace.mjs has normalizeStep/reviewStepFromLedger/escalationStepFromReviewDetail/landStepFromHistoryEntries but no self-review builder — all confirmed exact against the live tree.
- **consumer** (addressed; strategy: find consumers TWO ways: ES imports AND subprocess/hook callers) — Names both an ES-import consumer (we:scripts/lib/pipeline-trace.mjs's normalizeStep/reviewStepFromLedger, feeding #2818's timeline) and a subprocess consumer (the review-parked-prs recorder agent shelling `node we:scripts/lib/jury-ledger.mjs record`, confirmed live at we:scripts/workflows/review-parked-prs.mjs:1109-1138) — though see the step-6/step-7 finding: the consumer analysis is grounded in whichever step actually produces the persisted data, and the card's own writer instruction points at the wrong one.
- **interface** (addressed; strategy: round-trip test at the seam, written by whoever owns neither half) — Done-when criterion 2 explicitly requires a round-trip test (writer output fed back through the reader reproduces the same Step, no hand-built fixture) — exactly the seam-owned-by-neither-half test this risk calls for.
- **decorative-guard** (NOT addressed; strategy: mutate the guarded line; require a NAMED test to redden) — Criterion 1 (fails-before/passes-after) covers the new Step builder, but criterion 5 — 'nothing in step 6 gates PR-open on the record being written' — is explicitly Tier 3, 'read the step-6 block', with no named test proposed to redden if a future edit accidentally makes the write blocking. The card is at least transparent about this being the weakest tier rather than hiding it.
- **legibility** (NOT addressed; strategy: assert the failure SURFACES, not just that it occurs) — Criterion 5 says a failed write is 'reported, never a stop' but does not specify where that report surfaces durably; a best-effort write failure that only appears in an ephemeral agent transcript recreates exactly the durability problem Constraint 1 says the whole item exists to solve.

**Corrections applied by this review:**

- "The writer" section says the persistence write is wired into step 6 of we:skills-src/conveyor/delivery-agent-brief.md (confirmed live: step 6 is 'Review your own diff — spawn an adversarial code-review subagent', the step #2969 targets), but the card's own opening description of what needs persisting — 'the delivery-agent-brief screenshots, reads, and iterates' — and its own citations (#2672/#2828, the visual-self-review cluster) describe step 7 ('Visual self-review — render the surface, READ the screenshot... iterate'), confirmed live at we:skills-src/conveyor/delivery-agent-brief.md:173-200; #2818, the item that filed 3113 as a prerequisite, explicitly names 'step 7, lines 166–192' as the thing with nothing written to disk.

The card's live-repo grounding is exceptionally precise (every cited line number, function name, and gitignore entry checks out exactly), but its own "Writer" section instructs wiring the persistence write into step 6 (the code-review step #2969 owns) while its opening premise and its own filing source (#2818, which explicitly cites "step 7, lines 166–192") describe the VISUAL self-review — a real internal contradiction that would misdirect an implementer to the wrong integration point.

_Recorded through the declared `review-prep` operation._
