---
bornAs: xig98vg
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/operations/__tests__/probation-build-run.test.mjs"]
dateOpened: "2026-09-30"
preparedDate: "2026-10-02"
preparedAgainstSha: "2c3fbe13ae553b425eda8d0ce7a21b25a8e412b6"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3197's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. When #4670 lands, add a table-driven test in `we:scripts/operations/__tests__/probation-build-run.test.mjs`. Assert that worker edits to lifecycle keys (`status`, `dateStarted`, `dateResolved`) and removal of existing `blockedBy` entries are refused; among changes to `blockedBy`, only additive changes pass. The implementation work is tracked in `we:backlog/4670-standalone-prepare-runs-are-discarded-as-card-tampering-with.md`.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3197@9ccd27dcf31bfa7cb9964f74220d3d381b67c700

## Done when

1. **Executable** — From the WE checkout, run Vitest against `we:scripts/operations/__tests__/probation-build-run.test.mjs`, selecting the new suite named `prepare frontmatter prevention #4671`. Every row below passes with #4670 implemented; allowing a forbidden lifecycle edit or blocker removal, or rejecting additive blockers, makes the matching row fail.
2. The full existing test file passes, including ordinary build tamper protection and prepare scope correction. Rejected prepare rows never stamp, commit, or open a PR; accepted rows reach `opened-pr` through fake IO.

## Progress

- Original premise/scope: the card scoped only the #4670 backlog document and cited its line 12 plus a nonexistent root-level `we:probation-build-run.test.mjs`. It requested prevention tests after the implementation landed.
- Corrected premise/scope: this is a test-only follow-on to #4670, scoped to the existing `we:scripts/operations/__tests__/probation-build-run.test.mjs`. No production source changes are included, so no source entry lacks a matching test scope entry. #4670 remains open in this checkout; its implementation is a prerequisite to a green additive-blocker case, not work to absorb here.
- Source evidence: `we:scripts/lib/probation-launcher.mjs:210` allows only `scope`, `preparedDate`, and `preparedAgainstSha` in prepare mode. Its comparator at `we:scripts/lib/probation-launcher.mjs:239` strips allowed key lines and compares the remainder; it does not implement additive blocker semantics. The worker check is now at `we:scripts/operations/probation-build-run.mjs:443` (not the older approximate line 398 cited by #4670).
- Existing coverage: the standalone prepare harness starts at `we:scripts/operations/__tests__/probation-build-run.test.mjs:793`; the test at line 910 of that same file rejects even adding `blockedBy`, while the envelope table at line 915 covers a status edit and an extra file. It does not supply the requested lifecycle/blocker matrix. The goal is not already delivered.

## Design

Extend the existing standalone prepare fake-IO harness in `we:scripts/operations/__tests__/probation-build-run.test.mjs`, exercising `runProbationBuild` rather than duplicating the production frontmatter comparator. Give each table row a readable case name, baseline card, worker card, and expected outcome. Keep body, scope, worker success, and diff metadata valid and constant except for the frontmatter mutation under test.

Preserve the review's boundary: prepare workers cannot change lifecycle keys, and existing blockers cannot be removed. Additive blocker edits preserve every original blocker while adding one or more new blockers. An unchanged blocker list remains a valid control. This item tests that boundary after #4670 implements it; it does not decide #4670's broader allowlist, diagnostics, or diff-retention behavior.

For rows with existing blockers, keep the initial card read and worker card explicit. The harness's `openBlockers` stub returns no unresolved blockers, so admission cannot hide the post-worker comparison. Use valid item IDs and consistent raw/spec values. Retain the harness's stamping and committed-card readback so an accepted row traverses the later prepare-envelope check too.

## MVP

1. Add the named table-driven suite inside the existing standalone prepare tests in `we:scripts/operations/__tests__/probation-build-run.test.mjs`, reusing `prepareIo` and `prepareArgs`.
2. Replace the old blanket refusal of additive `blockedBy` with the matrix below once #4670 lands. Keep the independent extra-file and ordinary build-mode tamper tests.
3. Assert exact acceptance/refusal outcomes and side effects, not merely `outcome !== opened-pr`. Production fixes, if the matrix reveals one, belong to #4670 before this test-only item can complete.

## Test plan

In `we:scripts/operations/__tests__/probation-build-run.test.mjs`, cover these mutations through `runProbationBuild` with `taskType: prepare`:

| Mutation | Expected result |
| --- | --- |
| `status: open` changed to `active` or `resolved` | Refuse each row |
| Add `dateStarted` or `dateResolved` to a card lacking it | Refuse each row |
| Change or delete an existing `dateStarted` or `dateResolved` | Refuse each key/action row |
| Existing `blockedBy: [100, 101]` becomes `[100]` | Refuse |
| Existing blocker list becomes `[]`, or the whole key disappears | Refuse each row |
| Existing `[100, 101]` becomes `[100, 102]` (remove plus add) | Refuse |
| Missing `blockedBy` becomes `[100]` | Accept |
| Existing `[100]` becomes `[100, 101]` | Accept |
| Existing `[100, 101]` remains unchanged, with a valid body preparation | Accept control |
| Add a blocker and also change `status` | Refuse; the additive exception must not bypass other fields |

For every refused row require `escalated-needs-human` at the worker-envelope check and no `stamp`, `commit`, or `openPr` call. Accepted rows require `opened-pr`, stamping, and PR submission through fake IO; no row may call `claim` or `resolve`. Run the focused matrix, then the full file. These tests simulate runner effects and never launch a real worker or publish a PR.

## Proof plan

After #4670 lands, record the checkout SHA and the focused/full Vitest results for `we:scripts/operations/__tests__/probation-build-run.test.mjs`. Before that implementation, the additive acceptance rows should fail against the current blanket refusal; record this as the prerequisite gap, not a passing prevention guard.

Demonstrate sensitivity with temporary local mutations of `we:scripts/lib/probation-launcher.mjs` or the prepare check in `we:scripts/operations/probation-build-run.mjs`: allow a lifecycle key, permit blocker removal, and restore blanket blocker refusal, one at a time. The corresponding negative or positive matrix rows must fail. Restore each mutation before the next and leave only the test-file diff. These source paths are read/probe targets, not shipped scope. Run the standard consistency gate after restoring them. Attach observed output; a test name or a source inspection alone is not proof that a guard fires.

## Follow-ups

- Recheck #4670 at implementation time. If it has already supplied this entire matrix, identify its delivering commit and treat this debt as already done rather than duplicate tests.
- Diagnostics, retained worker diffs, wider prepare-owned fields, and the shared builder prepare path remain #4670's responsibility. This card adds only the independent review's standalone-runner prevention guard.
- No new policy decision is required for this matrix: additive-only blocker changes and lifecycle refusal are the explicit debt recorded above. If #4670 lands with a conflicting contract, surface that conflict before changing these expectations.
