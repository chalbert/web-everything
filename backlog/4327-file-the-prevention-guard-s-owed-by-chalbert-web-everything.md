---
bornAs: xkhionl
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/run-rating.mjs", "we:scripts/conveyor/__tests__/run-rating.test.mjs"]
dateOpened: "2026-09-27"
preparedDate: "2026-09-30"
preparedAgainstSha: "e2370f38045cdff5ff33e40dd312f310fff7f1af"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2811's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/conveyor/run-rating.mjs:1090` — Extract one shared seat-cost-summing helper used by both scanReviewJurorUsage and readReviewRunTelemetry so this initialization can only be gotten right or wrong once; short of that, a unit test asserting costUsd is null (never 0) whenever no seat in a run record prices would catch this class directly.
2. `we:scripts/conveyor/run-rating.mjs:1495` — No gate can catch an unused-but-plausible parameter path deterministically; the cheapest guard is a direct unit test for rateAndRecordReviewJob itself (currently absent — the test file imports rateReviewJobLog but never rateAndRecordReviewJob) asserting an injected runsDir reaches the join.
3. `we:scripts/conveyor/run-rating.mjs` — Add a deterministic coverage reconciliation test with one seat represented in both sources and require its tokens to appear exactly once.
4. `we:scripts/conveyor/run-rating.mjs` — Add a deterministic namespace-collision test and require an explicit item association before resolving story size for a PR.
5. `we:scripts/conveyor/run-rating.mjs` — Add an end-to-end fixture asserting that an escalated review's whole-run waste tokens equal its joined telemetry tokens.
6. `we:scripts/conveyor/run-rating.mjs` — Parameterize the A-grade gate tests over valid, excessive, null, and omitted wall time, requiring evidence for every mandatory condition.
7. `we:scripts/conveyor/run-rating.mjs` — Persist the review execution timestamp and add a deterministic test that permutes historical row insertion order while requiring identical effective grades.
8. `we:scripts/conveyor/run-rating.mjs:475` — A unit test in `classifyRunWaste` that asserts no `escalated-no-decision` waste is produced when `decisionReached` is true on the rating object (and ensuring `rateTranscript` actually propagates it).

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2811@e52307860e1308f40158e6ec13d6cab447f3bbeb

## Design

Premise check (vs `origin/main` e2370f380): every guard's underlying defect is still present; none is already covered by a test. `we:scripts/conveyor/__tests__/run-rating.test.mjs` imports `rateReviewJobLog` but not `rateAndRecordReviewJob`, and has no test for `readReviewRunTelemetry` (not exported; reached via `rateReviewJobLog`). Scope (`we:scripts/conveyor/run-rating.mjs` + its test file) matches the real touch-set. The work is tests, plus the smallest source fixes the tests force. Each guard, mapped to the real code:

1. **Null-not-zero cost** — `readReviewRunTelemetry` (`we:scripts/conveyor/run-rating.mjs:983`) starts `costUsd = 0` and only adds priced seats, so a run with zero priced seats returns `costUsd: 0, costUsdPartial: true`; `readReviewRunsIn` (`:1560`) returns `null` for the same seat. Fix: start `costUsd = null`, accumulate `(costUsd ?? 0) + …` for priced seats only. Mirror `computeTurnsCost` (`:560-575`), which already does this. No shared helper in the MVP (Follow-up).
2. **`rateAndRecordReviewJob` drops `io`** — `:1146` calls `rateReviewJobLog(logPath)` with no second arg, so `io.runsDir` never reaches `readReviewRunTelemetry`. Fix: pass `io` through. Test the function directly.
3. **Seat in both sources counted once** — `buildCoverageReport` (`:1652`) adds `claudeBuckets['dispatched-daemon'].tokens` (transcript scan) and `juror.claudeRows` tokens (run-record scan). Neither source carries a shared seat identity (transcripts have no seat id; run-record seats have no session id), so there is no join key to dedup on today. MVP: a clearly labelled characterization test pinning the current additive behaviour (the two sources are disjoint by construction: `dispatched-daemon` transcripts vs `review-pr-*.json` seat usage) so any future overlap change must update it deliberately. Defining a seat key and a real dedup is a DELIBERATE deferral (Follow-ups).
4. **Story-size namespace collision** — `rollupByDemand` (`:1218`) falls back to `sizeForItem(g.pr)`, and `backlogSizeForItem` (`:1252`) reads `backlog/<num>-*.md`. A PR number equal to some backlog item number silently takes that card's size. Fix: drop the `g.pr` fallback (size only resolves via an explicit `item`). Known cost, accepted: PR-only rows (`item: null`) lose `tokensPerStoryPoint` until an explicit PR→item association exists (Follow-ups) — a wrong size is worse than none. Test: a row with `pr: N`, no `item`, and a backlog card numbered N → `size: null`; inject the repo root with `sizeForItem: (n) => backlogSizeForItem(n, { repoRoot: tmp })` since `rollupByDemand` passes one argument.
5. **Escalated review waste tokens** — `rateReviewJobTimings` (`:879`) hardcodes waste `tokens: 0`; `rateReviewJobLog` (join at `:1034-1040`) then fills `rating.tokens` from telemetry but leaves `rating.waste` at 0. Fix: after the join, set the `escalated-no-decision` waste entry's `tokens` to the joined total. End-to-end fixture: an escalated log + run record → waste tokens equal the row's `tokens` sum.
6. **A-gate evidence** — `gradeRun` (`:675`) treats `wallMs` null/omitted as passing `withinBaselineForA`, so an unknown wall time can earn an A. Parameterize the tests over valid / excessive / null / omitted `wallMs`. Decide the contract in the test: a null/omitted `wallMs` must NOT be A (the operator's "hard conjunction" ruling needs evidence for every condition); fix `withinBaselineForA` to require a number when a baseline exists. "Omitted" and `null` share one code path (`typeof !== 'number'`), both still listed as cases. Side effect, accepted: a transcript without timestamps (`rateTranscript` yields `wallMs: null`) can no longer grade A, so new-row A counts may drop.
7. **Effective grade independent of insertion order** — `effectiveGrade` (`:1719`) already picks "later" rows by `scoredAt`, not array position. Test: permute the row order in `allRowsByPr` and assert identical effective grades (`effectiveGrade` is module-private and the test is vacuous through `resolveReviewGrade` alone, so the MVP MUST export `effectiveGrade`). Persisting a separate review-execution timestamp is a DELIBERATE deferral to Follow-ups; this MVP only pins the current `scoredAt`-ordering behaviour.
8. **No `escalated-no-decision` when a decision was reached** — `classifyRunWaste` (`:809`) emits it on `outcome === 'escalated'` alone and ignores `decisionReached`, which `rateTranscript` receives (`:826`) but never passes into the rating. Fix: propagate `decisionReached` onto the rating and gate the waste entry on `!rating.decisionReached`. Test both the classifier and `rateTranscript` end to end.

## MVP

Musts only — one test per guard 1–8 above, plus the minimal source change each one forces (items 1, 2, 4, 5, 6, 8 have a real defect; 3 and 7 may land as characterization tests if they pass). All edits are in `we:scripts/conveyor/run-rating.mjs` and `we:scripts/conveyor/__tests__/run-rating.test.mjs`. Out of scope (see Follow-ups): the shared seat-cost helper, a persisted review-execution timestamp.

## Test plan

- **cost null, not 0** (`rateReviewJobLog` with a run record whose only seat has an unpriced model): asserts `costUsd === null`; RED today (`0`).
- **`rateAndRecordReviewJob` honors `runsDir`** (one `io = { runsDir, path }` with both temp dirs — `path` points the scorecard store at a temp file so the real store is never written; the store root otherwise follows `CONVEYOR_STATE_ROOT`): asserts the appended row has `dataQuality: 'juror-telemetry'`; RED today (falls back to `job-log-only`, `tokens: null`).
- **coverage reconciliation** (characterization, GREEN today): a transcript file and a run-record seat; asserts attributed tokens equal their sum, labelled as pinning current additive behaviour.
- **namespace collision**: `rollupByDemand` with `sizeForItem: (n) => backlogSizeForItem(n, { repoRoot: tmp })`; PR-only row with a colliding card number → `size: null`; RED today (takes the card's size).
- **escalated waste tokens**: escalated log + run record; asserts `waste[0].tokens` equals `tokenBagTotal(rating.tokens)` (the fix converts the joined token bag to a total); RED today (`0`).
- **A-gate parameterized** (`it.each` over valid / excessive / null / omitted wallMs, every other condition met): asserts A only for valid; RED for null/omitted.
- **insertion-order permutation**: several row orders, same effective grades; GREEN guard (characterization).
- **no waste when decisionReached** (`classifyRunWaste` + `rateTranscript`): asserts no `escalated-no-decision` when `decisionReached: true`; RED today.

## Proof plan

- `npx vitest run we:scripts/conveyor/__tests__/run-rating.test.mjs` — show the new cases RED on `origin/main` source (stash the source change) and GREEN after.
- Live before/after: `node we:scripts/conveyor/run-rating.mjs report` against the real scorecard store (under `CONVEYOR_STATE_ROOT`) before and after; review-job rows with unpriced-only seats go from `$0` to unknown, PR-only demands lose `tokensPerStoryPoint`, and new-row A counts may drop — no other totals shift (report the diff).

## Follow-ups

- Extract one shared seat-cost-summing helper used by `scanReviewJurorUsage` and `readReviewRunTelemetry` (guard 1's preferred structural fix).
- Persist the review execution timestamp on review rows so effective grade no longer depends on `scoredAt` (guard 7's root fix).
- Define a seat identity key shared by transcripts and run records, then dedup coverage on it (guard 3's real fix).
- Note: `decisionReached` defaults `false` in production, so guard 8's gate is inert until a caller passes it; wire the real caller.
- Require an explicit item association everywhere size is resolved (beyond removing the `g.pr` fallback).

## Done when

1. **Executable** — `npx vitest run we:scripts/conveyor/__tests__/run-rating.test.mjs` passes, and the six defect-guard cases (1, 2, 4, 5, 6, 8) fail on the pre-change source (3 and 7 are labelled characterization tests and pass both ways).
