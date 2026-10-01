---
bornAs: xdk2nt2
kind: story
size: 3
parent: "3383"
status: open
dateOpened: "2026-09-23"
preparedDate: "2026-09-30"
preparedAgainstSha: "57b54c601b0518cbf3ede27d2e403a489d8d67cf"
scope: ["we:scripts/lib/dispatch-supervisor-contract.mjs", "we:scripts/lib/dispatch-task-type.mjs", "we:scripts/lib/dispatch-contracts.mjs", "we:scripts/conveyor/run-scorecard-store.mjs", "we:scripts/lib/__tests__/dispatch-supervisor-contract.test.mjs", "we:scripts/lib/__tests__/dispatch-task-type.test.mjs", "we:scripts/lib/__tests__/dispatch-contracts.test.mjs"]
tags: []
---

# Planner build: plan schema and routing inputs (task type by cause then files, doc allowlist, sizeSource plan)

Child 1 of #3922. Remove the planner-declared taskType from PLAN_OUTPUT_SCHEMA; derive a step type from why it exists (planned, apply clash to conflict-resolution, repair of accepted work to bugfix) then its files; make the doc test an allowlist of reader-facing doc places; make decideDispatchRoute honour sizeSource plan; pass risk through raiseRisk; record new versus modified files and lines on each trial.

## Progress

**Old premise/scope:**
- Remove `taskType` from `PLAN_OUTPUT_SCHEMA`.
- Derive step type from cause (planned, conflict, bugfix) then files.
- Make doc test an allowlist.
- Make `decideDispatchRoute` honour `sizeSource: 'plan'`.
- Pass risk through `raiseRisk`.
- Record new/modified files and lines on each trial.

**Corrected premise/scope:**
- **Already delivered:** `raiseRisk` is already used in `we:scripts/lib/dispatch-contracts.mjs:179` to raise derived risk. "apply clash to conflict-resolution, repair of accepted work to bugfix" is already implemented in `we:scripts/lib/dispatch-task-type.mjs` via `DISPATCH_CAUSES` and `taskTypeFor`.
- **Remaining work:**
  - Remove `taskType` from `PLAN_OUTPUT_SCHEMA`'s task `profile` (`we:scripts/lib/dispatch-supervisor-contract.mjs`).
  - Add `planned` to `DISPATCH_CAUSES` and derive its `taskType` from its `failingFiles`/`scopePaths` in `we:scripts/lib/dispatch-task-type.mjs`.
  - Refine `isDocScopePath` in `we:scripts/lib/dispatch-task-type.mjs` to a strict reader-facing allowlist.
  - Handle `plan` size source in `decideDispatchRoute` (`we:scripts/lib/dispatch-contracts.mjs`).
  - Add `newLoc`/`modifiedLoc` and `newFiles`/`modifiedFiles` (or similar) to `validateScorecard` schema in `we:scripts/conveyor/run-scorecard-store.mjs`.

## Design

- **`PLAN_OUTPUT_SCHEMA`:** Remove `taskType` from `profile`. The planner outputs `filesTouched`, `estimatedLoc`, etc., and the orchestrator derives the `taskType` from the files and cause.
- **Task Type Derivation:** `taskTypeFor` will accept `cause: 'planned'`. If `planned`, it will evaluate the `scopePaths` to return `doc-fix`, `build-new-feature`, or `test-fix` rather than relying on the `kind: 'build'` checks alone.
- **Doc Test:** Narrow `isDocScopePath` to explicitly allowlisted paths (e.g. `docs/`, `src/_data/`, `src/_includes/`) rather than any `.md` file anywhere.
- **Size Source:** `resolveFixSize` or equivalent logic in `decideDispatchRoute` will accept `sizeSource: 'plan'` when a size is provided by the planner instead of the backlog card.
- **Trial Records:** `validateScorecard` in `we:scripts/conveyor/run-scorecard-store.mjs` will be updated to require/allow `newLoc`, `modifiedLoc`, `newFiles`, `modifiedFiles` (nullable or optional) to record detailed change footprint for each trial.

## MVP

- `PLAN_OUTPUT_SCHEMA` does not contain `taskType`.
- `taskTypeFor` correctly maps a `planned` cause to its type based on `scopePaths`.
- `decideDispatchRoute` accepts and records `sizeSource: 'plan'`.
- `we:scripts/conveyor/run-scorecard-store.mjs` schema includes new diff footprint fields.

## Test plan

- Unit tests in `we:scripts/lib/__tests__/dispatch-supervisor-contract.test.mjs` for the schema.
- Unit tests in `we:scripts/lib/__tests__/dispatch-task-type.test.mjs` for `planned` cause and `isDocScopePath` allowlist.
- Unit tests in `we:scripts/lib/__tests__/dispatch-contracts.test.mjs` for `sizeSource: 'plan'`.
- Unit tests in `we:scripts/conveyor/__tests__/run-scorecard-store.test.mjs` (if it exists) or related tests for the new trial fields.

## Proof plan

- A simulated planner output passes validation and is correctly routed with a `planned` cause, its `sizeSource` recorded as `plan`, and its `taskType` correctly derived without being declared in the JSON.

## Follow-ups

- Expand planner trials to actually populate the new/modified LOC fields in the scorecard store at execution time (this card only adds the schema fields).
