---
bornAs: xa86i9a
kind: task
preparedDate: "2026-09-30"
status: resolved
dateOpened: "2026-09-30"
dateResolved: "2026-09-30"
tags: []
---

# Isolate prepare lanes and enforce card-only prepare PR metadata

On 2026-09-30 about 09:40Z, automatic prepare for #4368 opened PR #3075 from lane/4368-prepare-mid-work-guard with merge-commit title "Merge pull request #3073 from chalbert/lane/4341-prepare-wip-queue" and also carried card #4341. The title risks resolve-on-land crediting the wrong item. Fix we:skills-src/conveyor/prepare-item-agent-brief.md and prepare PR construction in we:skills-src/conveyor/build-dispatch-daemon.mjs or we:scripts/operations/dispatch-lane-io.mjs: fresh origin/main lanes, deterministic item-specific prepare titles, and refusal before open-pr for any diff outside the item card. Add title and diff-guard regression tests.

## Done when

1. Related Vitest tests for the producer pass regression cases for deterministic titles and refusal of other-card/code diffs before publication. (Paths: we:scripts/operations/prepare-pr.mjs, we:scripts/operations/open-pr.mjs, we:scripts/operations/open-pr-io.mjs.)
2. Prepare acquisition starts at origin/main and the brief forbids merging another lane.

## Prep

Design/MVP: enforce the prepare ref’s item identity at the canonical producer, with a fixed title and a pre-publication three-dot diff check allowing only the unique card on origin/main. Refuse failed observations and lane merge commits. Pin the validated source SHA. Require fresh origin/main acquisition in the brief and reject prepare acquisition overrides.

Test plan / Proof plan: local temporary Git histories reproduce another card inherited from a predecessor, an unrelated code file, a misleading merge subject, and a merge with a card-only net diff. Assert refusal prevents the producer subprocess and a valid card-only change receives the exact title and validated SHA. Run related Vitest tests and the standards gate.

Follow-ups: none within this defect. No commit, push, or PR during this repair.

## Implementation

The missing title argument in we:skills-src/conveyor/prepare-item-agent-brief.md reached the source-subject fallback at we:scripts/pr-land.mjs:756. The planner and submission boundary now impose the prepare title; we:scripts/operations/prepare-pr.mjs validates the full diff and history before publication. The acquisition policy in we:scripts/lane-pool.mjs rejects alternate prepare bases and skipped resets.

## Validation

All seven new regression tests pass. The initial full related run passed 3,182 tests; two unrelated cases were blocked by sandbox permissions (localhost socket and machine-wide home-directory writes). The standards checker reports one error: task size is disallowed by repository convention. Size 2 is retained as explicitly requested for this task.

Related rerun: 65 test files passed, 3,181 tests passed, three tests matching the socket/machine-wide-location exclusions skipped. No production code was changed to accommodate the sandbox. Resolved through the declared resolve operation.
