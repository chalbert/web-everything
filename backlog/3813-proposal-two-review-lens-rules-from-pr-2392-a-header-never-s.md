---
bornAs: x8fprww
kind: story
size: 3
parent: "3383"
status: open
scope: ["we:scripts/lib/review-core.mjs", "we:scripts/lib/jury-core.mjs", "we:scripts/lib/jury-ledger.mjs", "we:scripts/lib/__tests__/review-core.test.mjs"]
dateOpened: "2026-09-21"
tags: []
---

# Proposal: two review-lens rules from PR #2392 (a header "never"/"still refused" claim needs a named test; a state-matrix check needs one test per cell)

FOUND 2026-09-21. The review of PR #2392 found two untested guards by mutation probe (the assertReady race re-check and the deleted-branch refusal in we:scripts/operations/handoff-home.mjs), and each finding asked for a lens rule: any never or still refused claim in a file header needs a named test for that exact line, and a state-matrix check needs one test per cell. Design-first, UNCLEARED, a proposal only: it changes a review prompt, so it needs the operator's OK before any build. Do not build, and do not queue, until the operator says so.

## Evidence

- The review is the "✅ review — accepted" comment on PR #2392 (recorded 2026-09-21T17:43:50Z, reviewed sha `b50927b78604f08bc62931f045c3266ed6706908`). It is the second comment, not the last: the last one is now the drain's "Merge trace", so the command in the original brief (`.comments[-1]`) no longer returns it. This card reads the review's own text; the mutation probes below are the review's, not re-run by this filing (running them means editing a source file, which this filing did not do).
- Its findings, each with the rule it asked for:
  - `assertReady` race guard untested. Probes: body replaced with `void 0`, all 14 tests in we:scripts/operations/__tests__/handoff-home.test.mjs still green; the whole `throw diverged` line deleted, all 24 tests (that file plus the transport's) still green. Prevention line: "add a review-lens rule that any 'still refused' or 'never' claim in a header needs a named test for that exact line".
  - The refusal to recreate `ops/handoff` when the branch is gone from origin but the working copy has history, untested. Probe: `if (!tip && head) {` replaced by `if (false) {`, all 24 tests green. The "never pulled" test covers only the opposite cell (`tip && !head`). Prevention line: "add a rule that a state-matrix check must have one test per cell".
- Where the claims and guards sit on main today (`a4ff83ea6`): the header claim is at we:scripts/operations/handoff-home.mjs:14-29 (lines 21-23 say the `assertReady` hook re-checks the tip so a racing push "is still refused rather than written over"); the deleted-branch guard is at :209-211; the `assertReady` guard is at :224-226. The review cited :196, :210 and :226; the file has moved a little since.
- Both untested-guard findings were raised by the SECURITY lens's juror, and the correctness lens raised a neighbouring test-coverage finding on the same guard. The correctness lens already carries the bar "every changed branch is exercised, and no test is missing, weakened, or gamed to pass" (`LENS_EXPECTATIONS`, we:scripts/lib/review-core.mjs:1886). So this proposal does not add a new bar; it adds the two concrete methods a juror needs to apply the existing one.
- Where a rule would live: `LENS_HUNT_BRIEF` (we:scripts/lib/review-core.mjs:1904, read by `huntBriefForLens` :1931 and used at :1108) has exactly one entry today, for `claim-accuracy`. A correctness entry would be the second. Lens names: `MANDATE_LENSES` (we:scripts/lib/jury-core.mjs:1107). One-line charters: `REVIEW_LENS_CHARTER` (we:scripts/lib/jury-ledger.mjs:149; correctness reads "find logic errors, broken behaviour, and unhandled cases in the diff"). The existing brief test (we:scripts/lib/__tests__/review-core.test.mjs:1792) asserts every `LENS_HUNT_BRIEF` key is a panel lens and non-empty.

## Related open cards (read today), distinct or overlapping

- #3280 (an "X already handles this" claim must line-cite): same file, different rule. It extends `LENS_EXPECTATIONS` rather than the hunt brief. Its line reference (we:scripts/lib/review-core.mjs:1847) is stale: `LENS_EXPECTATIONS` is at :1885 today.
- #2860 (`check:standards` gate: a test whose TITLE claims a refusal must assert the throw): different. It gates test titles, not header claims.
- #2967 (two `check:standards` rules a PR #1064 review named; status `active`): same family, different rules.

## The design choice (needs the operator's OK)

- **(1) A `LENS_HUNT_BRIEF` entry for the correctness lens only** (prompt text). The juror must ground each "never" / "still refused" header claim by naming the test that reddens when that line is removed, by mutation probe, and must expect one test per cell of a state matrix. Cheap; reuses the mechanism `claim-accuracy` already uses; changes a review prompt.
- **(2) Also a deterministic `check:standards` rule** linking a header claim to a named test. No prompt change, but blocked: a header "never" claim has no machine-readable form today, so the rule needs a header-claim grammar first.
- **(3) Do nothing** and rely on the mutation-probe habit that found these two gaps. Costs nothing; the gaps were found only because one reviewer ran the probe.
- Sub-question: put the rules in the correctness brief, or fold them into #3280 so the correctness lens is edited once? Also: should the security lens carry its own copy, since its juror raised two of the three findings?

**Proposed default: (1)**, correctness lens, folded with #3280 if the operator prefers one edit. Reason: option (2) has no grammar to gate on, and (3) leaves the gap this review found open.

## Done when

Written for the proposed default (1). NOT to be built until the operator says so.

1. **Executable** — `npx vitest run review-core` passes with a new case asserting that `huntBriefForLens('correctness')` is non-empty and contains both rules (the named phrases "still refused" and "one test per cell"), and that the correctness entry of `REVIEW_LENS_CHARTER` (we:scripts/lib/jury-ledger.mjs:149) is unchanged. Fails today: `huntBriefForLens('correctness')` returns the empty string.
2. **Executable** — `npx vitest run review-core jury-core jury-ledger` stays green (the every-key-is-a-panel-lens check at we:scripts/lib/__tests__/review-core.test.mjs:1792 covers the new entry).
3. **Executable** — `npm run check:standards` reports 0 errors.
