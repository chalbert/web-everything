---
bornAs: x56mcj7
kind: story
size: 3
parent: "4075"
status: resolved
scope: ["we:scripts/conveyor/__tests__/lease-reaper.test.mjs"]
dateOpened: "2026-09-28"
dateResolved: "2026-09-30"
preparedDate: "2026-09-30"
preparedAgainstSha: "34c31da60813d2553402f46535413125bb9b30f1"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2870's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/conveyor/__tests__/lease-reaper.test.mjs:841` — Use a spy and assert that exec was not called, creating a deterministic regression gate for the no-execution contract.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2870@7911dc9462526db99e56d2ded8031fd37a6ff7fd

## Done when

1. **Executable** — `npx vitest run` on `we:scripts/conveyor/__tests__/lease-reaper.test.mjs` with `-t "no-check-sessions disables"` passes after this lands, and fails when the mutation in the Proof plan is applied to `fetchSessionSignals` (it passes today under that same mutation, which is the defect).

## Design

Premise check (current `main` 34c31da60): still real. The card's `:841` is now `we:scripts/conveyor/__tests__/lease-reaper.test.mjs:866`, the test `'--no-check-sessions disables the axis with no exec call at all — states/agents both null'`. Its `exec` is `() => { throw new Error('must not be called'); }`, but `fetchSessionSignals` (`we:scripts/conveyor/lease-reaper.mjs:1264-1272`) wraps `defaultListAgents({ exec, ... })` in a `try/catch` that returns `{ states: null, agents: null }`. So if a regression removed the `flags['no-check-sessions']` early return at `:1265`, the throwing `exec` would be swallowed by that catch and the test would still pass: its assertions (`states`/`agents` null) are identical on both paths. The "no execution" contract is therefore not actually gated.

Fix: replace the throwing stub with `const exec = vi.fn();` and add `expect(exec).not.toHaveBeenCalled();` (plus `expect(result.pidAlive.size).toBe(0)`). `vi` is already imported (`:21`). A spy records the call even when the caller swallows the error, so the gate is deterministic. Test-only change; `scope:` is already correct (the one test file).

## MVP

Musts only: rewrite the single test at `:866` to use a `vi.fn()` spy and assert `not.toHaveBeenCalled()`. Out of scope: the same swallow-the-throw pattern in sibling tests (see Follow-ups); any change to `we:scripts/conveyor/lease-reaper.mjs`.

## Test plan

- `--no-check-sessions … no exec call at all`: asserts `exec` spy has zero calls, `states`/`agents` null, `pidAlive` empty. Fails RED against a mutated `fetchSessionSignals` with the `:1265` early return removed (exec is then called by `defaultListAgents`; the spy records it), whereas the current throwing-stub version stays green under the same mutation.

## Proof plan

Mutation before/after on the live code in the lane: (1) with the original test, delete the `:1265` early-return line locally and run the file: the test still passes (demonstrates the gap); (2) with the new spy test, same mutation: the test fails on `expect(exec).not.toHaveBeenCalled()`; (3) restore `we:scripts/conveyor/lease-reaper.mjs` via `git checkout` on it: green. Paste the three run outcomes in the PR body. Do not commit the mutation.

## Progress

- 2026-09-30: Replaced the throwing stub in the scoped test with `vi.fn()`, asserted zero exec calls, and asserted an empty `pidAlive` map alongside the existing null states/agents assertions.
- Before proof: temporarily removed the `no-check-sessions` early return from `we:scripts/conveyor/lease-reaper.mjs`. Running `npx vitest run we:scripts/conveyor/__tests__/lease-reaper.test.mjs -t "no-check-sessions disables"` (strip the `we:` locus prefix when executing) against the original test exited 0: 1 passed, 172 skipped. The swallowed `must not be called` error demonstrated the gap.
- After proof: the same mutation and focused command with the spy test exited 1: 1 failed, 172 skipped, specifically at `expect(exec).not.toHaveBeenCalled()` with one recorded `claude agents --json --all` call.
- Restored the runtime file byte-for-byte in a `finally` block after each mutation; its git diff is empty. The focused command then exited 0 (1 passed, 172 skipped), and the full `we:scripts/conveyor/__tests__/lease-reaper.test.mjs` run exited 0 (173 passed). No runtime change or helper file is retained.
- Required lane gate: `node we:scripts/verify-lane.mjs` (strip `we:` when executing) exited 0 and recorded green at `79ae244c`: 173 tests passed; `npm run check:standards` reported 0 errors and 4559 warnings.

## Follow-ups

- Same defect in `we:scripts/conveyor/__tests__/lease-reaper.test.mjs:1042-1052`: the `--no-check-prs` and unrecognized-repo tests pass a throwing `exec` into `fetchPrStatesForRepo`, whose `try/catch` (`we:scripts/conveyor/lease-reaper.mjs:1211-1224`) also swallows it and returns `null`. Convert to spies in a separate item.
- A lint/standards rule flagging `() => { throw … 'must not be called' }` stubs handed to functions that catch.
