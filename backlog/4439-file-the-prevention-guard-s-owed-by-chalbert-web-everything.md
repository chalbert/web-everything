---
bornAs: xpsuizi
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/lib/model-probation.mjs", "we:scripts/lib/__tests__/model-probation.test.mjs"]
dateOpened: "2026-09-28"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2849's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/lib/model-probation.mjs:338` — Add a `lookupPr` contract that returns the review-label timestamp, and require the verdict to postdate the launch's `scoredAt`. Cover it with a test.
2. `we:scripts/lib/model-probation.mjs:503` — Extract the `judge` command into an exported `runJudge({lookupPr, io, dryRun})` and test it. Have the sweep re-read the store under the append lock before writing. Report the count of failed lookups, distinct from the count still awaiting a verdict.
3. `we:scripts/lib/model-probation.mjs:595` — In lookupPr, treat `files.length >= 100` (or a `changedFiles` count from gh mismatching the list) as unknown scope and omit `filesTouched`, so the existing fail-closed path applies. Add a test for it.
4. `we:scripts/lib/model-probation.mjs:338` — Require the `review:accepted` label (or the review-verdict record) before stamping `independent-claude` on a `landed` row. Otherwise use a non-counted verifier value. Add a test that a merged PR with no review label is not counted as verified.
5. `we:scripts/lib/model-probation.mjs:344` — Add a deterministic regression test for rejected and reworked trials with missing scope and omitted evaluator, including through judgePendingTrials; require the evaluator or default to the real classifier.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2849@02c8e95a475a1b652e7db73114386ca5bbc57479

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
