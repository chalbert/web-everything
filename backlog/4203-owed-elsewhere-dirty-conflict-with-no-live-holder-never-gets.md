---
bornAs: xs81oxb
kind: story
size: 3
parent: "4075"
status: resolved
scope: ["we:scripts/conveyor/parked-pr-conflict-watch.mjs", "we:scripts/lib/rebase-drop-manifest.mjs"]
dateOpened: "2026-09-26"
dateStarted: "2026-09-26"
dateResolved: "2026-09-26"
tags: []
---

# owed-elsewhere DIRTY conflict with no live holder never gets a rebase (PR #2709 shape)

A DIRTY PR carrying no review-workflow label at all (not review:human/pending/changes, not review:accepted/ready-to-merge) -- e.g. a formerly-stacked PR whose base merged and GitHub retargeted its base to main -- matches nothing: we:scripts/conveyor/parked-pr-conflict-watch.mjs only acts on an uncleared review hold or an accepted/queued PR; we:scripts/conveyor/ci-red-recovery-watch.mjs / we:scripts/conveyor/main-red-recovery.mjs only act on a failing required check; we:scripts/conveyor/reconcile-core.mjs's STACKED-BASE CONFLICT branch only fires when baseRefName != defaultBranch. It falls through to the generic OWED_ELSEWHERE.conflicted refusal and stays owed-elsewhere forever, confirmed live on chalbert/web-everything#2709 (fix(#4138), stacked on #2708 which merged) -- mergeStateStatus DIRTY, labels=[checking], no review:* label, fix-dispatch daemon logging reconcile-refused owed-elsewhere every tick. Fix: extend we:scripts/conveyor/parked-pr-conflict-watch.mjs to also catch this THIRD, unowned population, attempt the SAME proven we:scripts/lib/rebase-drop-manifest.mjs plumbing the drain/ci-red-recovery already use (never the GitHub update-branch REST endpoint -- we:scripts/conveyor/main-red-recovery.mjs's own header already recorded that endpoint reintroduces the we:.lane-manifest.json collision), and on a real (non-manifest) conflict route it into the existing bounce+fix-dispatch pipeline (review:changes + merge-status:conflicting), which we:scripts/conveyor/reconcile-core.mjs already caps via CONFLICT_FIX_ROUND_CAP -- so it never refuses forever.

## Done when

1. **Executable** — `npx vitest run we:scripts/conveyor/__tests__/parked-pr-conflict-watch.test.mjs` — before this
   lands, `isUnownedConflictTarget`/`defaultAttemptUnownedConflictRebase` do not exist and the pinned regression
   ("a CONFLICTING PR with no review-workflow label at all is no longer ignored — it is the UNOWNED population")
   fails; after, it (and the SOAK scenario replaying #2709's own stacked-base-merges lifecycle) passes.
