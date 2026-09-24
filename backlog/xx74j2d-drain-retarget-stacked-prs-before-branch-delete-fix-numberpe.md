---
kind: story
size: 5
parent: "3383"
status: active
scope: ["we:scripts/merge-ai-prs.mjs", "we:scripts/lane-drain.mjs", "we:scripts/__tests__/lane-drain-numbering.test.mjs"]
dateOpened: "2026-09-24"
dateStarted: "2026-09-24"
tags: []
---

# Drain: retarget stacked PRs before branch delete + fix numberPendingHashes O(refs) fallback scan

Two live drain defects under epic #3383. (1) we:scripts/merge-ai-prs.mjs merges a PR with --delete-branch (or the repo auto-deletes on merge) with no check for OPEN PRs stacked on that branch as their base — GitHub CLOSES (never retargets) the stacked PR when its base ref vanishes (live incident: chalbert/web-everything#2578 closed when #2549 merged). Fix: before the merge/delete, list open PRs with --base=<headRef> and retarget them to the repo's default branch first. (2) we:scripts/lane-drain.mjs numberPendingHashes' resolveReference fallback (#2903) builds visibleHashItems by running ONE git ls-tree -r subprocess PER visible ref (refs/heads + refs/remotes) to answer 'does backlog/<hash>.md exist there' — with 2200+ refs in this clone that is a 10-14 minute wall-clock stall (measured live: drain passes at 21:16Z/21:31Z/21:43Z UTC took 845936ms/698476ms/671913ms vs the ~40-60s baseline), and it is the exact cause of the drain-daemon passes bogging down tonight. Fix: replace the O(refs) ls-tree fan-out with ONE git cat-file --batch-check call answering the same membership question for every (ref x hash) pair in a single process.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
