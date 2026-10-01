---
bornAs: xggb0ep
kind: task
status: open
scope: ["we:scripts/conveyor/review-status-tag.mjs", "we:scripts/conveyor/__tests__/review-status-tag.test.mjs", "we:scripts/lib/review-label-provider.mjs"]
dateOpened: "2026-09-28"
preparedDate: "2026-09-30"
preparedAgainstSha: "b63802c2c7e5e5b7f00cdbe00d14883884a31c42"
tags: []
---

# Status label must say ci-red when required CI finished red (not awaiting-ci)

WE PR #2865 carried `review-status:awaiting-ci` for ~1h while every check had completed and the required `soak-replay-gate` check was FAILED (a draft PR, so fixers correctly skip it) — the operator read the label as "still waiting" when CI had actually finished red.

## Progress
**Old premise**: The card stated that `we:scripts/conveyor/review-status-tag.mjs` derives the label from the PR's check-run states, and merely fails to distinguish pending vs completed-red. Scope was only `we:scripts/conveyor/review-status-tag.mjs`.
**Corrected premise & scope**: `we:scripts/conveyor/review-status-tag.mjs` does *not* currently read check-run states at all; its `deriveReviewStatus` just blindly yields `awaiting-ci` if the PR is a draft. Furthermore, `PR_STATE_FIELDS` in `we:scripts/lib/review-label-provider.mjs` does not fetch `statusCheckRollup`. The scope must expand to include the provider file to fetch check states, and the test file `we:scripts/conveyor/__tests__/review-status-tag.test.mjs`.

## Design

1. **Fetch CI state**: Add `statusCheckRollup` to `PR_STATE_FIELDS` in `we:scripts/lib/review-label-provider.mjs`.
2. **Derivation fix**: In `we:scripts/conveyor/review-status-tag.mjs`, update `tagReviewStatus` to read `subject?.statusCheckRollup` and pass the check states down into `deriveReviewStatus`. Update `STATUS_LABEL_RE` to include `review-status:ci-red`.
3. **Status logic**: In `deriveReviewStatus`, when no live agents are actioning the PR, inspect the checks instead of blindly defaulting to `awaiting-ci` for drafts. Distinguish:
   - **pending**: one or more required checks have not finished yet. Yields `awaiting-ci`.
   - **completed-red**: all checks finished, and a required check failed. Yields `ci-red` on a non-draft PR.
   - **all-green**: unchanged existing behavior.
4. **Owed-to-author signal**: On a draft PR with `completed-red` CI, emit `review-status:needs-human` (this is the existing repo signal for attributing an action to the author) instead of `awaiting-ci` or `ci-red`, so the red state is attributed to the author rather than silently parked.

## MVP

The derivation fix in `we:scripts/conveyor/review-status-tag.mjs` (fetching `statusCheckRollup`, passing it, and evaluating pending vs completed-red required checks) plus the `ci-red` label constant/emission and the `needs-human` (owed-to-author) marking on a draft PR. Unit tests in `we:scripts/conveyor/__tests__/review-status-tag.test.mjs` for the cases: all-pending, all-green, completed-red draft, completed-red non-draft. Expanded scope includes `we:scripts/lib/review-label-provider.mjs`. Not MVP-blocking: historical backfill.

## Test plan

Run `npx vitest run we:scripts/conveyor/__tests__/review-status-tag.test.mjs`.
Add test cases in `deriveReviewStatus` for:
- `statusCheckRollup` missing or pending (returns `awaiting-ci` if draft).
- `statusCheckRollup` completed red on non-draft (returns `ci-red`).
- `statusCheckRollup` completed red on draft (returns `needs-human`).
- `statusCheckRollup` completed green (returns `null` so next phases can run).

## Proof plan

Run `node we:scripts/conveyor/review-status-tag.mjs <pr>` on a draft PR known to have finished red (like WE PR #2865) and observe it correctly outputs `{ changed: true, label: "review-status:needs-human" }` instead of `awaiting-ci`. Observe the script executes correctly with real `gh` output containing the new `statusCheckRollup` field.

## Follow-ups

- Check if other daemon stages (like `we:scripts/conveyor/reconcile-core.mjs` or `we:scripts/conveyor/ci-red-recovery-watch.mjs`) need to consume `review-status:ci-red` or if they already handle CI red natively using their own check states.
