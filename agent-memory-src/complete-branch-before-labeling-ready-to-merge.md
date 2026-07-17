---
name: complete-branch-before-labeling-ready-to-merge
description: Push the whole branch + verify BEFORE creating the PR or applying ready-to-merge — the drain daemon merges at the first review-accepted commit and strands the rest
metadata:
  type: feedback
---

Finish the branch, THEN open the PR and label it. Never apply `ready-to-merge` (or create
the PR) on a branch you are still pushing commits to.

**Why:** the constellation drain is an always-on daemon (`plateau-app:tools/drain-daemon/`,
runs `merge-ai-prs.mjs --label=ready-to-merge` on a ~60s cadence). It reviews a
`ready-to-merge` + `review:pending` PR and, once review flips to `review:accepted`, MERGES
it — at whatever commit is current on that pass. Real incident (Jul 2026, plateau-app #62):
the PR was created + labeled right after commit 1 (the webcases taxonomy), then 4 more
commits (the viewer) were pushed. The daemon merged #62 at the commit-1 state before the
later pushes; those 4 commits stranded on a now-merged branch with no open PR, needing a
`git rebase --onto origin/main <landed-commit>` + a fresh PR (#63) to actually land.

**How to apply:** do all the work + `git push` the complete branch + run the FULL suite
(`npx vitest run`, not just touched files), THEN `gh pr create` and add `ready-to-merge` +
`review:pending`. If you must push more after labeling, first remove `ready-to-merge` so the
daemon can't land a partial branch. Complements [[pr-is-the-standard-flow-not-a-question]]
and [[drain-gated-build-review-resolve-loop]].
