---
bornAs: xl8pvh7
kind: story
size: 3
parent: "3383"
status: open
scope: ["we:scripts/conveyor/branch-sync.mjs", "we:scripts/conveyor/branch-drift.mjs", "we:scripts/operations/wip-report-io.mjs"]
dateOpened: "2026-09-20"
tags: []
---

# Prototype branch drifts from main: a regular merge policy for lane/mechanical-dispatcher

FOUND 2026-09-20. The prototype branch lane/mechanical-dispatcher has drifted far from main. Measured against origin/main today (git rev-list, merge base ca7e68b71 from 2026-09-14): 220 commits only on the branch (the reaper worker counted 219) and 406 commits only on main. Main has files the branch lacks, confirmed: we:scripts/operations/operator-queue.mjs, we:scripts/operations/runner-activity.mjs and we:scripts/operations/runner-activity-io.mjs. The branch's own wip report, we:scripts/operations/wip-report-io.mjs, says so in its header and works around it by searching other checkouts for those files; where none is found the runner reads unknown (state unknown, reason runner-activity is not on any checkout found) and no runner-down row can appear. The branch also carries duplicate backlog ids (3663 to 3666 appear twice; main has none, confirmed by listing card ids on both), which is the branch-health card (check:standards fails with 15 errors, backlog 3768) and is NOT duplicated here. Existing related cards, resolved or open: 3464 (no reconciliation cadence for a long-lived diverged branch), 3556 (auto-dispatch a reconciliation agent when branch-sync escalates), 3553 (no skill points a long-lived-branch maintainer at branch-sync), 3637 (POC-branch delivery mode); we:scripts/conveyor/branch-sync.mjs and we:scripts/conveyor/branch-drift.mjs exist on main. This card is the policy question they leave open: what does a regular merge of main into this specific branch look like. DESIGN TO SETTLE: (1) who merges and when (a scheduled worker, or before each graduation slice, or when the count of main-only commits passes a threshold); (2) the conflict policy (main wins for files main owns, branch wins for branch-only files, a human on the rest; the merge never rebases or force-pushes a shared branch); (3) how duplicate backlog ids are avoided on the merge, since the branch and main number cards independently (the JIT numbering at land on main versus ids minted on the branch); (4) how graduation slices interact: a slice that graduates a branch file to main should land after the merge that brings the branch up to date, or the graduation diff is wrong; (5) whether branch-sync already does the merge and only needs a schedule. ACCEPTANCE: after the merge the branch contains the three operator-queue and runner-activity files and the wip report reads a real runner state instead of unknown; the merged branch has zero duplicate backlog ids; a test or check proves the main-only commit count is reported and stays under the stated threshold.

## Finding (2026-09-21): the loop that carries out this policy is filed separately

Card xfgv680 is the mechanical loop (a dedicated clone, a merge commit, a fast-forward-only push after a clean merge, the per-branch lock, the `autoSync` gate, a freeze plus alert on conflict, then a reconcile agent). It depends on this card's policy points (who and when, the conflict rules, duplicate ids, graduation order). New evidence recorded there: the live sync process is stuck at attempt 5 since 2026-09-12 and cannot push; a hand merge showed 54 conflicts and was staged once on `origin/lane/mechanical-dispatcher-catchup` without reaching the shared branch; as of 2026-09-21 `origin/main` has 446 commits the branch lacks and the branch has 253 that main lacks.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
