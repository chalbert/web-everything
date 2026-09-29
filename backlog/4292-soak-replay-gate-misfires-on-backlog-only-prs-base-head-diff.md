---
bornAs: xcdvaow
kind: story
size: 2
parent: "4075"
status: active
scope: ["we:.github/workflows/soak-replay-gate.yml", "we:scripts/lib/soak-replay-gate.mjs", "we:scripts/lib/daemon-soak-scope.mjs", "we:scripts/lib/__tests__/soak-replay-gate.test.mjs", "we:scripts/soak-replay-gate-cli.mjs"]
dateOpened: "2026-09-27"
dateStarted: "2026-09-29"
tags: []
---

# soak-replay-gate misfires on backlog-only PRs (base..head diff, not merge-base)

we:.github/workflows/soak-replay-gate.yml computes its changed-file diff as a plain two-endpoint git diff --name-status against the PR's base sha, not a merge-base diff. On PR #2822 (backlog-only, four new we:backlog/*.md cards, no daemon code touched) this misattributed main's own since-diverged edits under daemon-soak scope to the PR, so we:scripts/lib/soak-replay-gate.mjs's touchesDaemonSoakScope read true, and isLikelyDaemonBugFix then read the cards' prose (daemon/fix/break, describing future work) as a bug-fix signal — the PR went red on the required soak-replay-gate check and the worker had to hand-add a soak-waiver: line. This is the same class of bug already tracked in we:backlog/4264-soak-replay-gate-workflow-s-two-endpoint-diff-counts-main-s.md (4264): compute the workflow's diff from the merge-base (git diff --name-status -M $(git merge-base BASE_SHA HEAD_SHA) HEAD_SHA), confirm that also closes this concrete #2822 incident, and add a regression test in we:scripts/lib/__tests__/soak-replay-gate.test.mjs reproducing #2822's exact shape (a backlog/*.md-only diff plus PR-body prose containing daemon/fix/break describing future work) asserting evaluateSoakReplayGate returns applicable:false with no waiver needed.

## Done when

1. **Executable** — `npx vitest run we:scripts/lib/__tests__/soak-replay-gate.test.mjs` — the "backlog-only PR whose body prose reads fix-shaped (PR #2822)" case asserts `evaluateSoakReplayGate` returns `applicable:false` with no waiver for a `backlog/*.md`-only file list plus daemon/fix/break prose (and pins that the same prose DOES read as fix-shaped, so the verdict rests on the scope check, not the heuristic).
2. **Observable** — the merge-base diff itself already landed under 4264 (`we:scripts/lib/soak-gate-merge-base-diff.mjs`, `--base-sha`/`--head-sha` in `we:.github/workflows/soak-replay-gate.yml`); its end-to-end real-git replay of #2822 in `we:scripts/__tests__/soak-replay-gate-cli.test.mjs` confirms that change closes this incident too.

## Progress

- 2026-09-29: Confirmed the workflow already computes the diff from the merge-base (landed via 4264, whose CLI test replays #2822's divergent-history shape end to end: two-endpoint → `applicable:true`, merge-base → `applicable:false`). Nothing left to change in the workflow/CLI. Added the unit-level #2822 regression case to `we:scripts/lib/__tests__/soak-replay-gate.test.mjs`; 32/32 pass.
