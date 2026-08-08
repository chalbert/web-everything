---
kind: story
size: 5
status: resolved
dateOpened: "2026-08-08"
dateStarted: "2026-08-08"
dateResolved: "2026-08-08"
tags: [gate, review, drain, review-escalation, clear-human]
scope:
  - we:scripts/lib/review-escalation.mjs
  - we:scripts/review-set-label.mjs
  - we:scripts/merge-ai-prs.mjs
  - we:scripts/lib/__tests__/review-escalation.test.mjs
  - we:scripts/__tests__/review-set-label.test.mjs
---

# A drain re-score revokes a human clearance: a content-preserving rebase invalidates review:accepted and strips it

The drain re-parks a just-cleared PR minutes later because its own rebase-onto-main shifts diff context, and it deletes the `review:accepted` the operator applied.

## Observed (PR #1100, PR #984)

PR #1100's label timeline:

```
14:38:35 labeled   review:accepted   \
14:38:35 unlabeled review:changes     >  review-set-label.mjs --to=clear-human
14:38:35 unlabeled review:human      /
14:41:09 (commit 6b929515 — "drain: rebase … onto origin/main, drop transient .lane-manifest.json")
14:41:42 labeled   review:human      \  the resident drain daemon's next pass
14:41:44 unlabeled review:accepted   /
```

PR #984 shows the same signature three minutes apart (`review:pending` instead of `review:human`, because its
fresh score did not say `humanRequired`).

The writer is the resident drain daemon (`plateau-app:tools/drain-daemon/daemon.mjs`) spawning
[we:scripts/merge-ai-prs.mjs](scripts/merge-ai-prs.mjs) `--label=ready-to-merge` on an interval. The two writes are
the stale-acceptance branch of the review-escalation pass: `--add-label <gate.applyLabel>` (add-first) followed by
`--remove-label review:accepted` (remove-last).

## Root cause — measured, not inferred

`decideReviewGate` honours `review:accepted` only when `acceptanceCoversHead` says the acceptance covers the live
head (#2409). The head-SHA test fails after any rebase, so #x169fqe added a content escape: compare
`normalizeDiffFingerprint` of the reviewed net diff against the live one.

Recomputing both sides for #1100:

- reviewed net diff (`f388c40f22 → 10b97e6aba`) fingerprint `fc64ed8b42fd…` — byte-identical to the
  `<!-- reviewed-diff: … -->` marker on the clear-human comment;
- live net diff (`d661276fd7 → 6b929515af`) fingerprint `48f2dadb4067…`.

The two 130 KB diffs differ in exactly three lines, and **none of them is the PR's own content**:

1. two `index <old>..<new>` blob-pair lines (already excluded from the fingerprint);
2. one **context** line that `main` changed under the lane (PR #1102 renamed a test);
3. one **hunk header offset** (`@@ -197,3` → `@@ -203,3`) because that file grew on `main`.

Every `+`/`-` line is identical. So the acceptance covered exactly this contribution — the fingerprint says
otherwise only because it hashes the *base the contribution sits on* as well as the contribution. The drain
rebases every accepted lane onto `main` within minutes and `main` moves constantly, so the #x169fqe escape almost
never fires in practice and the clearance is revoked on essentially every accepted PR.

## The rule to implement

1. **A clearance covers a contribution, not a base.** Stamp a base-independent *contribution* fingerprint
   alongside `reviewed-diff` and honour it in `acceptanceCoversHead`. A move that changes only context lines and
   hunk offsets is covered; any change to an added/removed line is not.
2. **A re-score never re-asserts the human gate over content the human already saw.** On a genuinely stale
   acceptance the drain still refuses to land, but it re-parks `review:human` only when the *paths the clearance
   did not cover* include a declarative-leash path; otherwise `review:pending`.
3. **A re-score never removes `review:accepted`.** The refusal to land is the gate's verdict, not the deletion of
   a human's record. Only a reviewer verdict (`--to=changes`) retracts an acceptance.

Related: #2409 (reviewed-commit gate), #2416 (only a human clears a human gate), #2895 (the `clear-human`
ceremony), #2771 / #2840 (what `review:human` is reserved for).
