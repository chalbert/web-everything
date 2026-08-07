---
kind: story
size: 2
status: open
relatedTo: ["2882", "2896", "2644"]
scope: ["we:scripts/review-set-label.mjs"]
dateOpened: "2026-08-07"
tags: [gate, review, drain]
---

# Accepting a bounced PR leaves review:changes on it, and three consumers act on the stale label

`decideSetLabel`'s `accepted` target returns `removeLabels: [pending]` — it does not drop
`review:changes`. So accepting a PR that was previously bounced leaves **both** `review:accepted` and
`review:changes` on it. The two sibling targets are not asymmetric this way: `changes` drops a stale
`accepted`, and `clear-human` drops human + pending + changes. Only `accepted` under-clears. Observed
live on PR #1064, whose labels after `--to=accepted` were `[ready-to-merge, review:accepted,
review:changes]`.

## Not cosmetic — three consumers read the raw label

The obvious defence is that `review:accepted` wins: both `hasUnclearedReviewLabel` and `decideReviewGate`
in `we:scripts/lib/review-escalation.mjs` check `accepted` first and return before inspecting `changes`,
and the drain's land gate goes through `hasUnclearedReviewLabel`. That protects the merge decision — and
only the merge decision. Three independently-written consumers key off `review:changes` presence with no
accepted-check anywhere in the function:

- **`we:scripts/lane-resume.mjs`** — its `land()` returns `action: 'review-changes'` and refuses to land,
  so `/finish` cannot repair a stuck lane whose PR is already accepted.
- **`we:scripts/conveyor/pr-watch.mjs`** — `review:changes` sits in `PARK_LABELS`, feeding both the
  watcher's parked-exit (which sends the main session to run `/review` on an already-accepted PR) and
  `isReadyToLand`, which gates the fast-drain trigger.
- **`we:scripts/conveyor/status-board.mjs`** — `reviewLabelOf()` surfaces the first `review:*` hit as
  "NEEDS YOU", so an accepted PR is reported to the operator as awaiting attention.

Accepted-first ordering is a property of two functions, not of the label set. Every consumer that does
not replicate that ordering sees a PR that is simultaneously accepted and bounced.

## Fix

Add `REVIEW_LABELS.changes` to the `accepted` branch's `removeLabels`. `presentRemoveLabels` already
narrows the list to labels the PR actually carries, so no absent-label error is possible. The pure
decider is single-sourced, so one edit covers the CLI, the drain, and the conveyor re-arm.

## Done when

- `decideSetLabel({ to: 'accepted' })` drops `review:changes` alongside `review:pending`.
- A unit case pins it — accepting a PR carrying `changes` leaves neither `changes` nor `pending`.
- The invariant that `accepted` never removes `review:human` is unchanged and still tested.
