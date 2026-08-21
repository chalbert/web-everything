---
bornAs: xe850rq
kind: task
status: open
dateOpened: "2026-08-05"
tags: [statute, review-policy, agent-memory]
---

# Codify the no-regression land bar in platform-decisions, reconciled with #2851

The operator ruled on 2026-08-05 that the bar for landing is **no regression + no new impact** (now + **no
weakened gate**), not "no findings". That ruling re-specifies **when a finding blocks** — a statute-layer
concern — but it was recorded only as an agent-memory leaf
(`we:agent-memory-src/land-on-no-regression-not-perfection.md`). Nothing in
`we:docs/agent/platform-decisions.md` records it and there is no `codifiedIn` anchor.

Meanwhile the ratified `#fix-review-convergence-independent-root-cause` (#2851, operator, 2026-08-02) still
specifies the unamended loop: the fix↔review cycle iterates until the diff is clean, with **invariant 2**
requiring every round to address root cause and **invariant 3** escalating only on non-convergence. So the effective bar depends on which
surface an agent happened to load — statute reader bounces on a confirmed incompleteness finding, memory reader
lands it.

**Work:** write the ruling into `we:docs/agent/platform-decisions.md` with an anchor, state explicitly how it
amends or bounds #2851 (it narrows what counts as "clean" for the convergence loop's exit condition — confirm
that reading with the operator), and point the memory leaf at the anchor.

**Judgment needed:** the #2851 reconciliation is a real ruling, not a transcription. Do not codify a reading the
operator has not confirmed.

**Prevention for:** review finding on PR #1040 (correctness lens). Related durable guard worth considering: a
write-time gate requiring an operator-ruling memory leaf to link a statute anchor, so "memory holds the pointer,
statute holds the rule" is enforced rather than recalled.

## Design

**What is on disk today** (read 2026-08-21): the ruling lives only at
`we:agent-memory-src/land-on-no-regression-not-perfection.md`. It already states the three tests
(no regression / no new impact / no weakened gate), the mandatory-lens carve-out, and the
statute-codification exemption — so codifying is largely a *relocation with an anchor*, not fresh authoring.
`we:docs/agent/platform-decisions.md` carries no anchor for it; the anchor
`#fix-review-convergence-independent-root-cause` (#2851) is there and still specifies the unamended
convergence loop.

**The anchor machinery this must satisfy.** `we:scripts/lib/validate-rules-anchors.cjs` runs three checks
that bear on this item, all through `runStatuteCheck` (`:520`):

- `validateRulesAnchors` (`:50`) — a backlog item's `codifiedIn` must resolve to a real anchor. So setting
  `codifiedIn` on this item at resolve time is what makes the gate assert the anchor exists.
- `validateAnchorSubstance` (`:169`) — an anchor cited by `codifiedIn` must carry ≥120 characters of real
  body. A stub anchor pointing back at the memory leaf will not pass.
- `findOrphanAnchors` (`:116`) — an anchor nothing references is reported, so the memory leaf's back-link
  is not optional decoration.

**The reconciliation is the judgment half, and it is a real fork, not transcription.** #2851's invariant 2
requires each round to address root cause and invariant 3 escalates only on non-convergence; the operator's
bar says a finding blocks only on regression / new impact / weakened gate. The candidate reading — that the
ruling **narrows what "clean" means for #2851's exit condition** rather than replacing the loop — is exactly
the reading the item says must be confirmed with the operator.

**But do NOT write "proposed / awaiting confirmation" into the anchor.** That is precisely what
`#statute-anchor-states-rule-not-status` (#2854, ratified 2026-08-17,
`we:docs/agent/platform-decisions.md:3502`) forbids — and it names *this* anchor cluster as its motivating
bad example, so the mistake would be made on the exact text the rule was written about. The sequencing that
respects it: hold the anchor **unwritten** until the operator confirms the reading, keep the proposed
wording on this backlog item (which stays `open` — that is where point-in-time status belongs), and write
the anchor once, in the timeless voice, at resolve time.

**Coordinate with #2853** (`status: open`, same `parent: 2822`), which re-points the owed-work sentence
inside `#fix-review-convergence-independent-root-cause` itself. Both items edit the same anchor cluster; land
order is a rebase concern, not a design one, but neither should silently overwrite the other's sentence.

**The durable guard named in the closing line** (a write-time gate requiring an operator-ruling memory leaf
to link a statute anchor) is a **separate item**, not scope here. File it rather than folding it in — it
changes `we:scripts/check-memory.mjs`, a different surface with a different failure mode.

## Done when

**No tier-1 criterion can cover the ruling itself**, and here is why rather than a hand-wave: the substance
of this item is a statute-layer reconciliation that an operator must confirm (the item says so outright:
*"do not codify a reading the operator has not confirmed"*). No command can decide whether the anchor's
reading of #2851 is the one the operator meant. Criterion 1 below is tier-1 over the *mechanics* of
codification, which is genuinely machine-checkable; criteria 2-5 are the judgment residue, and 4 is the one
that cannot be automated.

1. **tier 1 — the anchor exists, resolves, has substance, and the corpus stays green.** With this item's
   `codifiedIn` set to the new `we:docs/agent/platform-decisions.md` anchor, `npm run check:statute` and
   `npm run check:standards` both exit 0. Fails before — the anchor does not exist, so
   `validateRulesAnchors` reports an unresolved cite; and once written, `validateAnchorSubstance` and
   `findOrphanAnchors` catch a stub anchor or a missing back-link.
2. **tier 2 — the memory leaf points at the anchor.**
   `we:agent-memory-src/land-on-no-regression-not-perfection.md` links the new anchor by id, so "memory
   holds the pointer, statute holds the rule" is true on disk and greppable.
3. **tier 2 — the anchor states its relationship to #2851 explicitly**, naming whether it narrows, bounds or
   composes with it — not merely sitting adjacent to it. A reader arriving from either anchor reaches the
   same effective bar.
4. **tier 3 — the operator has confirmed the #2851 reading before the anchor is written.** The proposed
   wording lives on this item while it is unconfirmed; the anchor is written only after the confirmation and
   contains **no** status token (per `#statute-anchor-states-rule-not-status`). The item records the
   confirmation date and what was confirmed. This is the criterion no command can decide, and it is the
   item's real gate.
5. **tier 3 — the write-time-guard idea is filed as its own item**, referenced from here, rather than left
   as a closing suggestion that dies with this card.

The commands that decide 1:

```
npm run check:statute
npm run check:standards
```

## Independent review — 2026-08-21

Confidence: **Medium**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (addressed; strategy: confirm by mutation or reversion BEFORE building) — Verified directly: we:docs/agent/platform-decisions.md has no anchor or prose matching the no-regression/no-new-impact/no-weakened-gate ruling (grep for the phrases returns nothing), we:agent-memory-src/land-on-no-regression-not-perfection.md carries no codifiedIn/anchor back-link, and #fix-review-convergence-independent-root-cause (we:docs/agent/platform-decisions.md:3438) still reads exactly as the card describes (invariant 2: root-cause every round; invariant 3: escalate only on non-convergence/judgment). The card's 'read 2026-08-21' survey matches the live state.
- **consumer** (addressed; strategy: find consumers TWO ways: ES imports AND subprocess/hook callers) — The mechanical consumers are correctly identified and cited with exact line numbers: validateRulesAnchors (we:scripts/lib/validate-rules-anchors.cjs:50), validateAnchorSubstance (:169), findOrphanAnchors (:116), runStatuteCheck (:520) — all confirmed to exist at those lines and to be wired into both `npm run check:statute` and `npm run check:standards` (we:scripts/check-statute.mjs:22-25, we:scripts/check-standards.mjs:1658-1659). Other in-repo referrers to the memory leaf (we:agent-memory-src/index-meta.md:42, we:agent-memory-src/record-verdict-before-launching-converge.md:39) use a stable wiki-link to the leaf file itself, unaffected by the planned edit.
- **interface** (NOT addressed; strategy: round-trip test at the seam, written by whoever owns neither half) — Two problems the card does not name. (1) we:backlog/2853-correct-the-owed-work-pointers-in-the-stop-the-line-anchors-.md is OPEN and targets the same anchor cluster — its own body is quoted verbatim inside #fix-review-convergence-independent-root-cause today ('...while #2853 re-points this sentence at the items that actually own the work', we:docs/agent/platform-decisions.md:3442) — with no cross-reference from 2915 to that concurrent edit; this alone is a minor coordination gap, not a blocker (fixable at land time via normal rebase, common in this repo's history). (2) #statute-anchor-states-rule-not-status (#2854, we:docs/agent/platform-decisions.md:3502, ratified 2026-08-17) directly governs how confirmation/build status must be recorded for anchor prose and names this exact anchor as its motivating bad example; 2915's Design instructs writing status prose ('marked as proposed until confirmed') straight into the new anchor body — the reported finding below.
- **decorative-guard** (addressed; strategy: mutate the guarded line; require a NAMED test to redden) — Read the implementations, not just the docstrings: validateAnchorSubstance genuinely computes normalized character counts against a 120-char floor (we:scripts/lib/validate-rules-anchors.cjs:143-186), and findOrphanAnchors genuinely scans backlog+docs corpus text for `#id` references (:116-138) — these are real checks the item's `codifiedIn` will actually be run through by collectCodifiedCites' corpus-wide scan, not stubs.
- **unmeasured-impact** (addressed; strategy: measure the constraint before sizing) — The practical harm cited ('statute reader bounces on a confirmed incompleteness finding, memory reader lands it') is grounded in a real, findable precedent — PR #1040's correctness-lens finding, the same provenance cited by sibling items we:backlog/2916-check-memory-enforce-the-200-char-line-budget-on-sub-indexes.md and we:backlog/2917-gate-bare-nnnn-citations-in-agent-memory-pr-numbers-must-be-.md from the same review round — rather than an invented scenario.
- **legibility** (addressed; strategy: assert the failure SURFACES, not just that it occurs) — The card is explicit that the operator's reading must not be silently treated as ratified — it insists the anchor stay marked provisional until confirmed rather than quietly presenting a proposal as settled. The mechanism chosen to do that (status prose inside the anchor) is itself the problem reported below, but the underlying intent — don't let an unconfirmed reading pass as fact — is sound.

**Corrections applied by this review:**

- The card's intro paragraph attributes both 'root-cause every round' and 'escalation only on non-convergence' to '#2851 invariant 2'; in the live text (we:docs/agent/platform-decisions.md:3442-3444) root-cause-per-round is invariant 2 but escalate-only-on-non-convergence is invariant 3 — a minor mis-citation, not a substantive error.

The preparation's core diagnosis (missing anchor, unamended #2851 text) is accurately verified against the live repo down to exact line numbers, but its Design/Done-when instructions direct writing a "marked as proposed until confirmed" status token directly into the new anchor's prose — precisely the pattern the freshly-ratified #statute-anchor-states-rule-not-status (#2854, 2026-08-17) prohibits, on the very anchor cluster that ruling names as its own motivating bad example.

_Recorded through the declared `review-prep` operation._

### Response to that review (2026-08-21)

Both points accepted and fixed above — the second one materially changes the plan:

- **The `#statute-anchor-states-rule-not-status` conflict is real and was the right catch.** The first
  draft told the builder to write "marked *proposed* until confirmed" into the anchor body; #2854 (ratified
  2026-08-17) forbids exactly that, and names this anchor cluster as its own motivating bad example. The
  *Design* and criterion 4 now say: hold the anchor unwritten, keep the proposed wording on this item while
  it is `open`, and write the anchor once in the timeless voice after confirmation.
- **The invariant mis-citation is fixed** — root-cause-per-round is #2851's invariant 2, escalate-only-on-
  non-convergence is invariant 3.
- **#2853 coordination** is now named in *Design*: it edits a sentence inside the same anchor, so the two
  must not overwrite each other.
