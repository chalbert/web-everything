---
kind: story
size: 2
parent: "4075"
status: open
scope: ["we:.github/workflows/soak-replay-gate.yml", "we:scripts/lib/soak-replay-gate.mjs", "we:scripts/lib/daemon-soak-scope.mjs", "we:scripts/lib/__tests__/soak-replay-gate.test.mjs", "we:scripts/soak-replay-gate-cli.mjs"]
dateOpened: "2026-09-27"
tags: []
---

# soak-replay-gate misfires on backlog-only PRs (base..head diff, not merge-base)

we:.github/workflows/soak-replay-gate.yml computes its changed-file diff as a plain two-endpoint git diff --name-status against the PR's base sha, not a merge-base diff. On PR #2822 (backlog-only, four new we:backlog/*.md cards, no daemon code touched) this misattributed main's own since-diverged edits under daemon-soak scope to the PR, so we:scripts/lib/soak-replay-gate.mjs's touchesDaemonSoakScope read true, and isLikelyDaemonBugFix then read the cards' prose (daemon/fix/break, describing future work) as a bug-fix signal — the PR went red on the required soak-replay-gate check and the worker had to hand-add a soak-waiver: line. This is the same class of bug already tracked in we:backlog/4264-soak-replay-gate-workflow-s-two-endpoint-diff-counts-main-s.md (xei9oen): compute the workflow's diff from the merge-base (git diff --name-status -M $(git merge-base BASE_SHA HEAD_SHA) HEAD_SHA), confirm that also closes this concrete #2822 incident, and add a regression test in we:scripts/lib/__tests__/soak-replay-gate.test.mjs reproducing #2822's exact shape (a backlog/*.md-only diff plus PR-body prose containing daemon/fix/break describing future work) asserting evaluateSoakReplayGate returns applicable:false with no waiver needed.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
