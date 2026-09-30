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
4. **Verification**: Resolve the `UNVERIFIED` flags in `SUPERVISOR_INVOCATIONS` by asserting tool-free behavior in the CLI runner bindings.

## MVP

- `PLANNER_ROLE` and `CHECKER_ROLE` defined and routed through distinct ladders in `we:scripts/lib/dispatch-contracts.mjs`.
- Checker `newTasks` validation in `we:scripts/lib/dispatch-supervisor-contract.mjs`.
- Provide tests that prove planner and checker use different ladders and trust records.
- Assert the UNVERIFIED flags as VERIFIED or FALSE.

## Test plan

- **Unit tests** in `we:scripts/lib/__tests__/dispatch-contracts.test.mjs` covering trust record splits and ladder lookups for plan vs checker.
- **Unit tests** in `we:scripts/lib/__tests__/dispatch-supervisor-contract.test.mjs` asserting `newTasks` refusal and flag verification.

## Proof plan

- A CLI command executing a mocked dispatch with a high card size selects an Opus planner.
- A CLI command executing a mocked checker dispatch defaults to Sonnet.

## Follow-ups

- Operator tools to un-flag a checker miss cell back to Sonnet.

## Done when

1. **Executable** — `npx vitest run we:scripts/lib/__tests__/dispatch-contracts.test.mjs` passes and demonstrates independent planner vs checker tier upgrades.
