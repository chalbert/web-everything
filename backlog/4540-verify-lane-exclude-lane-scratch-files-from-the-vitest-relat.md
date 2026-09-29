---
bornAs: x88m779
kind: story
size: 2
status: open
scope: ["we:scripts/lib/verify-lane-gate.mjs", "we:scripts/readiness/test-selection.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# verify-lane: exclude lane scratch files from the vitest related target set

Split from #4473 MVP item (3). we:scripts/lib/verify-lane-gate.mjs's resolveDefaultGate builds its vitest related target list from the lane's full working-tree changed-file set (we:scripts/lib/verify-lane-gate.mjs's localChangedSet, tracked+untracked), which includes a lane's own scratch litter — the commit-message file, the PR-body file, and converge-state JSON (see we:scripts/lib/lane-litter.mjs's LANE_RELEASE_LITTER_ALLOWLIST for the exact known set of these paths) — none of which any test could plausibly cover, so including them only widens the vitest related invocation and the referencedTestNeedles grep for no benefit. Exclude paths matching that same known-scratch allowlist from the changed-file set BEFORE it reaches decideLocalSelection/testsNaming, without changing check:standards' own scoping (canScopeCheckStandards) or #4296's laneRelevantChangeSince, both of which have their own independent reasons to see the full changed set. Edge cases to name explicitly: (a) a scratch file that is the ONLY changed file (targets list must not go empty in a way that changes the vitest --passWithNoTests behavior versus today), (b) a real source file that happens to share a scratch file's exact basename (must match on the FULL relative path, never a basename-only heuristic), (c) the allowlist drifting out of sync with we:scripts/lib/lane-litter.mjs's own list (share the one constant, do not hand-copy it). Needs a wiring/integration test proving a diff containing ONLY a scratch file plus one real source file selects vitest related targets for the real file alone, not the scratch one.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
