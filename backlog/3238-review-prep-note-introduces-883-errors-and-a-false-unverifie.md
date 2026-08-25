---
bornAs: xyg1k8p
kind: task
size: 3
parent: "3029"
status: open
dateOpened: "2026-08-21"
preparedDate: "2026-08-25"
relatedTo: ["3233", "3230"]
tags: [operations, epic-3029, review-prep, preparation, gate]
scope:
  - we:scripts/operations/review-prep.mjs
  - we:scripts/operations/review-prep-io.mjs
  - we:scripts/operations/__tests__/review-prep.test.mjs
  - we:scripts/lib/citation-check.mjs
---

# review-prep note introduces #883 errors and a false unverified-prerequisite flag

The note we:scripts/operations/review-prep.mjs appends is not routed through the lint the CLI write path enforces, so it injects bare code-path refs into the card it just reviewed — 11 of 12 cards on one lane, 8 of 12 on another, on 2026-08-21. A card clean before review is dirty after it, so a caller validating only beforehand ships broken cards. Separately its own risk-strategy wording trips the check:standards non-batchable marker and makes the reviewed item read as non-agent-ready.

## CORRECTION (2026-08-25): the cited instance was wrong in two ways

The original last sentence located the live false positive in
`we:backlog/1637-review-hardcoded-color-lint-scope-alignment-a11y-contrast.md`. **No such file exists.** The
`1637` slot is `we:backlog/1637-capability-matched-task-queue.md`, a different card entirely.

Running the gate rather than trusting the card, the flag fires on **four** items, and #1637 is not among
them: **#3238 (this card, at its own line 4), #3100, #3103 and #2717.** So the defect is real, live, and
slightly worse than described — this card is its own reproduction case — while the evidence pointing at it
was a citation nobody had grepped. Recorded rather than silently fixed, per
`we:agent-memory-src/grep-every-name-you-cite-in-prose.md`.

Baseline at the time of writing: `npm run check:standards` is **0 errors, 1435 warnings**, so all four are
warnings and none is currently breaking the gate.

## The two defects are independent — say so, because the fixes differ

**(a) The note bypasses the locus-prefix lint.** Confirmed by construction, not inference:
`we:scripts/lint-locus-prefix.mjs` is wired as a `PreToolUse(Edit|Write)` hook in `we:.claude/settings.json`,
so it fires for an agent's file edit and cannot fire for a `node` process writing the same bytes directly.
`recordPrepVerdict` writes with `fs`, so every bare path in a juror's prose lands unchecked. (Live
demonstration: authoring *this* card through the Edit tool was refused twice — once for a personal email
address, once for four bare code-path refs — which is exactly the lint the node write path never reaches.)

**(b) The risk-strategy wording trips the non-batchable marker.** A phrase the note itself emits reads to
`we:scripts/check-standards.mjs` as the card asserting an unmet prerequisite, so an otherwise-batchable card
drops out of the agent-ready pool. This is a *wording* fix in the renderer, not a lint-routing fix.

## The decided design

**For (a):** route the rendered section through the same check the hook runs, inside
`renderPrepReviewSection` — reusing `we:scripts/lib/citation-check.mjs` rather than re-implementing a path
regex. On a violation the renderer does not silently rewrite the juror's prose: it returns the offending refs
so `record` can refuse with a determinate outcome, the same shape #3230 gives a failed read-back. Silently
prefixing was rejected — it would edit a reviewer's words to satisfy a linter, which is how a citation
becomes wrong in the first place.

**For (b):** change the emitted risk-strategy sentence so it no longer contains the marker phrase. Purely a
string change in the renderer; the four already-affected cards are reworded as part of this card.

## Interfaces

- `renderPrepReviewSection({date, confidence, risks, corrections, fixApplied, note})` gains a second return
  form: `{section, bareRefs: string[]}`. Callers that only want the text read `.section`.
- `recordPrepVerdict` refuses with `{recorded: false, reason: 'bare-refs', bareRefs}` when the array is
  non-empty — a determinate third outcome, consistent with #3230's.

## Tasks

1. Reword the risk-strategy sentence in the renderer; re-run the gate and confirm the count drops from four.
2. Reword the four live instances (#3238, #3100, #3103, #2717).
3. Wire the citation check into the renderer; return `bareRefs`.
4. Refuse in `record` on a non-empty `bareRefs`.
5. Tests for both.

## Delivery shape

Incremental behind `main`. Can land in #3233's PR or its own; no ordering constraint beyond touching the same
renderer, so if it lands separately it should land **after** #3233 to avoid a textual conflict in `record`.

## Done when

1. **Executable** — `npm run check:standards` reports the non-batchable marker on **zero** of #3238, #3100,
   #3103, #2717. It reports four today, so the command fails before and passes after.
2. **Executable** — `npx vitest run we:scripts/operations/__tests__/review-prep.test.mjs` passes a case
   feeding the renderer a `note` containing a bare code path and asserting `bareRefs` is non-empty and names
   that path.
3. **Executable** — a case asserting `recordPrepVerdict` returns `{recorded: false, reason: 'bare-refs'}` for
   that input, and that the card on disk is **unchanged**.
4. **Executable** — a case asserting a note whose paths are all properly prefixed yields `bareRefs: []` and
   records normally, so the check cannot be satisfied by always refusing.
5. **Mutation** — removing the `bareRefs` wiring reddens case 2 by name; reverting the reworded sentence
   reddens case 1.
