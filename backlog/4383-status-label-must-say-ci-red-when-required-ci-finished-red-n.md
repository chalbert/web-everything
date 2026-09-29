---
bornAs: xggb0ep
kind: task
status: open
scope: ["we:scripts/conveyor/review-status-tag.mjs"]
dateOpened: "2026-09-28"
tags: []
---

# Status label must say ci-red when required CI finished red (not awaiting-ci)

WE PR #2865 carried `review-status:awaiting-ci` for ~1h while every check had completed and the required `soak-replay-gate` check was FAILED (a draft PR, so fixers correctly skip it) — the operator read the label as "still waiting" when CI had actually finished red.

## Full design

`we:scripts/conveyor/review-status-tag.mjs` derives the `review-status:*` label from the PR's check-run states, but its derivation does not distinguish two different situations that both currently render as `awaiting-ci`:

- **pending** — one or more required checks have not finished yet (genuinely still waiting).
- **completed-red** — every check has finished, and a REQUIRED check (e.g. `soak-replay-gate`) finished FAILED.

Fix the derivation in `we:scripts/conveyor/review-status-tag.mjs` to emit a distinct `review-status:ci-red` label (rather than `awaiting-ci`) when the completed-red case is detected, so the label always reflects "still running" vs "finished, and it's red." On a draft PR (where fixers deliberately skip driving required checks), also apply the owed-to-author signal so the red state is attributed to the author rather than silently parked. Add unit tests covering: all-pending (unchanged `awaiting-ci`), all-green (unchanged existing green label), and completed-with-a-required-failure on both a draft and a non-draft PR (new `ci-red` path).

## Explicit MVP cut

MVP = the derivation fix in `we:scripts/conveyor/review-status-tag.mjs` (pending vs completed-red required checks) plus the `ci-red` label constant/emission and the owed-to-author marking on a draft PR, with unit tests for the four cases above (all-pending, all-green, completed-red draft, completed-red non-draft). Not MVP-blocking: any historical backfill of the label on already-open PRs (e.g. re-tagging WE PR #2865 itself) — the fix applies going forward on the next label-derivation pass.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
