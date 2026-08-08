---
bornAs: x534qrf
kind: story
size: 2
status: resolved
relatedTo: ["2882", "2896", "2644"]
scope: ["we:scripts/review-set-label.mjs"]
dateOpened: "2026-08-07"
dateStarted: "2026-08-08"
dateResolved: "2026-08-08"
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

## Seen again, six more times (2026-08-08)

An overnight review-and-merge pass hit this on every bounced PR it cleared — #1024, #1019, #1018,
#1034, #1021, #1068 — and had to drop the label by hand with `gh pr edit --remove-label` each time.
That hand-edit is exactly the out-of-band label mutation the CLI exists to prevent.

One fact to fold into the fix: the `rearm` target (`changes → pending`, #2644) that would otherwise
be the sanctioned way out **is unreachable from this CLI**. `REVIEW_LABEL_TARGETS` and
`decideSetLabel`'s `rearm` branch both exist, and `we:scripts/conveyor/rearm-review.mjs` calls it via
`fixedTo` — but the operator-facing argv parser only accepts `accepted|changes|clear-human` and
fails with `invalid --to — expected 'accepted', 'changes', or 'clear-human'`. So today there is no
supported path at all from `review:changes` to `review:accepted`.

Worse than the stale label: `--to=accepted` on a bounced PR returns `{"ok":true,...}` while producing
a self-contradictory label set. Whatever the fix, that call must not report success while leaving
`accepted` and `changes` together.

## Fix

Add `REVIEW_LABELS.changes` to the `accepted` branch's `removeLabels`. `presentRemoveLabels` already
narrows the list to labels the PR actually carries, so no absent-label error is possible. The pure
decider is single-sourced, so one edit covers the CLI, the drain, and the conveyor re-arm.

## Done when

- `decideSetLabel({ to: 'accepted' })` drops `review:changes` alongside `review:pending`.
- A unit case pins it — accepting a PR carrying `changes` leaves neither `changes` nor `pending`.
- The invariant that `accepted` never removes `review:human` is unchanged and still tested.
- Either `rearm` is reachable from the CLI's `--to`, or the `accepted` target handles the bounced
  case itself. A reviewer clearing a fixed PR never needs `gh pr edit`.
- `--to=accepted` never returns `ok:true` while leaving `review:accepted` and `review:changes`
  together.
