---
bornAs: x88m779
kind: story
size: 2
status: open
scope: ["we:scripts/lib/verify-lane-gate.mjs", "we:scripts/lib/__tests__/verify-lane-gate.test.mjs"]
dateOpened: "2026-09-29"
preparedDate: "2026-10-01"
preparedAgainstSha: "2eaedba64725229983194fbcc3a3ac06cc6fe221"
tags: []
---

# verify-lane: exclude lane scratch files from the vitest related target set

Split from #4473 MVP item (3). Exclude paths matching the shared lane-litter allowlist from the local Vitest selection input and reference-name discovery. Preserve the complete changed set for standards scoping and diagnostics, and preserve independent verification-invalidation behavior. Match full repository-relative paths using the existing matcher; do not infer scratch status from a basename.

## Progress

Preparation research confirmed the gap with a direct Node invocation of `resolveDefaultGate` using an injected Git runner. A changed set containing `we:.commit-msg.txt` and illustrative `we:scripts/example.mjs` produced both Vitest targets and both grep needles. Scratch alone produced a one-target related invocation; a genuinely empty diff produced the full gate. These are observations of command construction, not an executed Vitest run.

- **Old premise/scope:** both `we:scripts/lib/verify-lane-gate.mjs` and `we:scripts/readiness/test-selection.mjs` needed changes; the scratch examples suggested a small fixed file list, and the card described #4296 as seeing the same working-tree changed set. No matching test file was declared.
- **Corrected premise/scope:** the filtering belongs in `we:scripts/lib/verify-lane-gate.mjs#resolveDefaultGate`, with regression coverage in existing `we:scripts/lib/__tests__/verify-lane-gate.test.mjs`. The shared selector already accepts an explicit changed set, so `we:scripts/readiness/test-selection.mjs` is a read-only dependency. `we:scripts/lib/verify-lane-gate.mjs#laneRelevantChangeSince` independently compares committed revisions and intersects changes with the union of lane-relevant paths at both revisions; it does not consume `localChangedSet` directly. Preserve it unchanged.
- **Source evidence:** `we:scripts/lib/verify-lane-gate.mjs#localChangedSet` unions the tracked working-tree diff with untracked files. `we:scripts/lib/verify-lane-gate.mjs#resolveDefaultGate` currently passes that union unfiltered to `decideLocalSelection` and then derives grep needles from its related files. `we:scripts/readiness/test-selection.mjs#decideLocalSelection` forces a full suite for empty input, so filtering alone would regress the scratch-only case. The gate already skips its Vitest half when selection has zero remaining targets after deletions.
- **Allowlist evidence:** `we:scripts/lib/lane-litter.mjs#isAllowlistedLitterPath` defaults to `LANE_RELEASE_LITTER_ALLOWLIST`, which includes wildcard families and directory-shaped entries as well as fixed filenames. A direct matcher probe accepted `we:.commit-msg.txt` and rejected `we:scripts/.commit-msg.txt`. It accepted the literal directory entry `we:.conveyor/` but rejected `we:.conveyor/state.json`. The untracked-file enumeration emits individual files; this item must not silently turn directory allowlist entries into recursive exclusions.

## Design

Import `isAllowlistedLitterPath` from `we:scripts/lib/lane-litter.mjs` into `we:scripts/lib/verify-lane-gate.mjs`. Reuse its default allowlist and full-path semantics without copying patterns or changing cleanup behavior. Apply it to repository-relative paths returned by Git, without the documentation-only repository prefix.

Within `resolveDefaultGate`, retain the original `changedFiles` for `canScopeCheckStandards`, the standards command, and `decision.changedFiles`. Derive separate Vitest changed/deleted arrays by excluding allowlisted paths, and pass those arrays into `decideLocalSelection` before deriving reference needles or calling `testsNaming`. Leave `localChangedSet`, working-tree hashing, `laneRelevantChangeSince`, CI selection, and the shared selection module unchanged.

Handle a known, nonempty original diff whose filtered Vitest set is empty explicitly: when selection is enabled, return a shrink decision with empty related/trigger/deleted-source arrays and a reason identifying the scratch-only case. Reuse the gate's zero-target skip path with truthful wording that covers scratch exclusion as well as deletions. Do not issue a targetless `vitest related`, run grep, or escalate this case to the full suite. This preserves the intended successful no-tests behavior while removing scratch targets. A genuinely empty diff, unknown diff, or explicit `WE_DIFF_TEST_SELECTION=0` retains its existing full-suite behavior. Keep script-aware command composition intact.

Mixed diffs use the existing selector after filtering: real configuration changes and deleted source files still force full selection; remaining ordinary files and their referenced tests still select normally. Apply the existing target-count limit after filtering and reference expansion. Do not broaden the matcher to nested basenames, directory descendants, or additional scratch-looking names.

## MVP

1. Add the shared matcher import and separate Vitest input derivation in `we:scripts/lib/verify-lane-gate.mjs#resolveDefaultGate`, including the scratch-only branch and accurate zero-target message.
2. Extend `we:scripts/lib/__tests__/verify-lane-gate.test.mjs` using its injected `fakeGit` runner. Assert the resulting command, decision arrays, and captured grep arguments together so filtering after grep cannot pass.
3. Keep the original changed set observable in diagnostics and standards arguments. No changes to the allowlist, cleanup, shared selector, or invalidation code are required.

## Test plan

All new cases belong in `we:scripts/lib/__tests__/verify-lane-gate.test.mjs`, paired with the sole source entry in scope.

- Mixed wiring regression: one untracked `we:.commit-msg.txt` plus one real source path selects only the real path and tests naming that real path. Supply a fake grep hit for the scratch needle and prove it is never requested or selected. Standards arguments and `decision.changedFiles` still contain both changed paths.
- Scratch-only: no grep, no related targets, a successful explicit Vitest skip, and standards still runs with its original scoping. Repeat with selection opted out and assert the full unit-suite command remains.
- Full-path boundaries: a root scratch filename is excluded while illustrative `we:scripts/.commit-msg.txt` remains selected. Cover a wildcard scratch filename, an unknown scratch-looking name, and a child file under the directory-only `we:.conveyor/` allowlist entry; the latter two remain selected. Derive representative allowlist coverage from the shared exported list rather than duplicating it as production policy.
- Mixed scratch plus config, deleted source, backlog card, and policy-core file: preserve their existing full-suite or unscoped-standards decisions. Include tracked and untracked allowlist matches and filtered deleted entries.
- Preserve existing tests for unknown and truly empty diffs, deleted non-source zero-target selection, snapshots, script availability, target-count fallback, hashing, and revision-based invalidation. Add a boundary case where scratch entries alone would previously have pushed the related-target count above `MAX_RELATED_TARGETS`.

## Proof plan

During implementation, first add the mixed-diff regression and run the existing admitted unit-test command restricted to `we:scripts/lib/__tests__/verify-lane-gate.test.mjs`; record its failure on the current implementation because scratch reaches both targets and grep. After the change, rerun the same test file and record the passing result. Execute `npm run test:unit --` with that repository-relative test argument after removing its documentation prefix.

Also run the existing selector suites in `we:scripts/readiness/__tests__/test-selection-local.test.mjs` and `we:scripts/readiness/__tests__/test-selection.test.mjs` through the admitted unit-test command, then `npm run check:standards`. Capture before/after gate commands for mixed and scratch-only inputs, showing unchanged standards arguments and changed Vitest targets. Compare the explicit opt-out and truly empty cases to their current full-gate behavior. These checks are implementation proof requirements; this preparation has only run the command-construction and matcher probes described above.

## Done when

The mixed-diff regression in `we:scripts/lib/__tests__/verify-lane-gate.test.mjs` fails before implementation and passes after it. No allowlisted path reaches Vitest target or grep selection, scratch-only changes skip the Vitest half successfully, and the test plan demonstrates unchanged standards scoping, fallback behavior, and independent invalidation. All stated implementation checks pass.

## Follow-ups

No prerequisite design decision remains. Recursive exclusion of directory contents, new scratch patterns, relocation of scratch artifacts, and changes to CI selection or verification invalidation are outside this item. If directory descendants remain noisy, collect concrete paths and prepare that expansion separately; the current shared matcher does not authorize recursive matching.
