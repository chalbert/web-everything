---
bornAs: xt962ct
kind: story
size: 5
parent: "3383"
status: open
dateOpened: "2026-09-23"
tags: []
scope:
  - "we:scripts/lib/dispatch-contracts.mjs"
  - "we:scripts/lib/dispatch-supervisor-contract.mjs"
  - "we:scripts/lib/__tests__/dispatch-contracts.test.mjs"
  - "we:scripts/lib/__tests__/dispatch-supervisor-contract.test.mjs"
preparedDate: "2026-09-30"
preparedAgainstSha: "57b54c601b0518cbf3ede27d2e403a489d8d67cf"
---

# Planner build: separate planner and checker roles with their own trust records

Child 2 of #3922. Split the one supervise role into plan and supervise, each with its own ladder and trust record. Planner model by card size (Sonnet below 8, Opus at 8+ or high-risk or statute-tier). Checker Sonnet by default; a PR-panel-found miss moves that {model, taskType, risk} cell up to Opus; clean reviews since are recorded so the operator can move it back. Checker newTasks refused. Plan and verdict calls through SUPERVISOR_INVOCATIONS, verifying its two UNVERIFIED flags.

## Progress

**Old Premise/Scope:**
- `SUPERVISOR_INVOCATIONS` unverified flags were cited as "two UNVERIFIED flags".
- Planner model mapped to "card size" directly.

**Corrected Premise/Scope:**
- `SUPERVISOR_INVOCATIONS` is located in `we:scripts/lib/dispatch-supervisor-contract.mjs` and currently has *three* `UNVERIFIED` flags across `agy` and `claude-native` (`planPreventsWriteToolError`, `schemaMakesToolFree`, and `toolFreeSupervisorRound`).
- The router (`we:scripts/lib/dispatch-contracts.mjs`) currently has a single `supervise` role used for lookups in `SUPERVISOR_LADDERS`. The `SUPERVISOR_ROLE` constant is set to `build-supervisor`.
- Card size must be translated to `complexity` (e.g., L/XL mapped from 8+) or passed explicitly to the dispatch profile, since the dispatcher operates on `risk` and `complexity`.

## Design

1. **Role Split**: Update `we:scripts/lib/dispatch-contracts.mjs` to define `PLANNER_ROLE` and `CHECKER_ROLE` (or keep `SUPERVISOR_ROLE` and split its usage) in the router, maintaining separate trust records for each.
2. **Ladders**: Add separate `PLANNER_LADDERS` and `CHECKER_LADDERS` mapped to the profile `complexity` and `risk`. Map "card size 8+" to high complexity / high risk levels.
3. **Checker Behavior**: Checker `newTasks` must be rejected. The `verdictFromSupervisorOutput` logic should reject payloads where `newTasks` is not empty.
4. **Checker trust record**: a PR-panel-found miss moves the checker's `{model, taskType, risk}` cell up to Opus; each clean review since is recorded against that cell. Trust records are read through `routingRecords` in `we:scripts/lib/dispatch-contracts.mjs` (already in scope); the miss and clean-review rows are written as scorecard rows with `role: 'checker'`, so no file outside `scope:` is needed.
5. **Verification**: Resolve the `UNVERIFIED` flags in `SUPERVISOR_INVOCATIONS` only from a real observation — a live probe of each runner (agy, claude-native) whose command and recorded output are cited in the flag's `evidence` field. A flag with no recorded probe stays `UNVERIFIED`; it is never flipped by a mocked unit test.

## MVP

- `PLANNER_ROLE` and `CHECKER_ROLE` defined and routed through distinct ladders in `we:scripts/lib/dispatch-contracts.mjs`.
- Checker `newTasks` validation in `we:scripts/lib/dispatch-supervisor-contract.mjs`.
- Checker miss-cell promotion: a PR-panel-found miss writes a checker miss row, and the ladder lookup for that `{model, taskType, risk}` cell then returns Opus.
- Clean-review recording: a clean checker review writes a clean row against the cell, readable through `routingRecords`, so the operator can see the count since the miss.
- Provide tests that prove planner and checker use different ladders and trust records.
- Extend the status enum in `we:scripts/lib/dispatch-supervisor-contract.mjs` and the allow-list at `we:scripts/lib/__tests__/dispatch-supervisor-contract.test.mjs:85` with `'verified-by-live-probe'` and `'FALSE'`, and require an `evidence` citation on any flag using either value.

## Test plan

- **Unit tests** in `we:scripts/lib/__tests__/dispatch-contracts.test.mjs` covering trust record splits and ladder lookups for plan vs checker.
- **Unit test** that a checker miss row moves only its own `{model, taskType, risk}` cell to Opus while the planner cell and other checker cells stay put.
- **Unit test** that clean reviews are recorded and counted per cell after a miss.
- **Unit tests** in `we:scripts/lib/__tests__/dispatch-supervisor-contract.test.mjs` asserting `newTasks` refusal.
- **Unit test** that every `SUPERVISOR_INVOCATIONS` flag with status `verified-by-live-probe` or `FALSE` cites an `evidence` artifact (probe command plus recorded output or job id).

## Proof plan

- A CLI command executing a mocked dispatch with a high card size selects an Opus planner.
- A CLI command executing a mocked checker dispatch defaults to Sonnet, then selects Opus for the missed cell after a miss row is recorded.
- A live tool-free probe per runner (agy with `--mode plan --json-schema`, claude-native with `--tools ""`): run a supervisor round, confirm no write tool is exposed, and record the command and output as the `evidence` for that runner's flags. Mocked dispatch does not count as proof here.

## Follow-ups

- Operator tools to un-flag a checker miss cell back to Sonnet.

## Done when

1. **Executable** — this command, run from the repo root, passes, and the suite includes named tests for independent planner vs checker ladders, the checker miss-to-Opus promotion, clean-review recording, and `newTasks` refusal. The command is fenced because a `we:` prefix is a citation form, not a path: vitest treats it as a literal filter and finds no files.

```
npx vitest run scripts/lib/__tests__/dispatch-contracts.test.mjs scripts/lib/__tests__/dispatch-supervisor-contract.test.mjs
```
