---
bornAs: xmyt6nm
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/operations/__tests__/run.test.mjs", "we:docs/agent/delivery-loop.md"]
dateOpened: "2026-09-30"
preparedDate: "2026-10-02"
preparedAgainstSha: "ffa61fe661e7c1e6848a10fa615018c070e59183"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3174's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/operations/__tests__/run.test.mjs` (fresh-checkout test) — When adding a positive-control test next to a negative one, mutate the guarded code to fail unconditionally and confirm the control reddens. A review-lens checklist item on control tests is enough. No deterministic gate is practical.
2. `we:scripts/operations/__tests__/run.test.mjs` (`runCli`) — Give spawned CLI fixtures an allowlisted env (PATH, HOME pointed at a temp dir, the two store dirs, no GH/agent tokens). Add a lint rule for `spawnSync(..., {env: {...process.env}})` in test files that run operation CLIs, or make the test helper own the env.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3174@1f01548db1569f8d9810e257da7f0021f73407ae

## Progress

Preparation premise check (2026-10-02): the debt is still present; this is not already delivered.

- **Old premise/scope:** both prevention requests cited line 58 of we:scripts/operations/__tests__/run.test.mjs and scoped only that test. The positive control was presented as exercising a fresh checkout's preflight; the second request offered either a lint rule or a helper-owned environment.
- **Corrected premise:** in we:scripts/operations/__tests__/run.test.mjs, the fresh-checkout test invokes `dispatch-lane --help`. In we:scripts/operations/run.mjs, the operation-help branch exits before the `cliPreflight(name)` call. Thus this control cannot detect unconditional preflight refusal. The local `runCli` helper still spreads `process.env`, overriding only the two store directories. Symbol/test-name citations replace the misleading shared line reference.
- **Source evidence:** we:scripts/operations/run.mjs (`IS_CLI` block and `cliPreflight`); we:scripts/operations/dispatch-lane-io.mjs (`assertDispatcherFresh`); we:scripts/operations/dispatch-lane.mjs (`dispatchLaneOperation` input requires `num`); we:scripts/operations/cli-adapter.mjs (`runOperationCli` returns code 2 on parse failure before constructing the judge or starting/writing a run). The bare-origin fixture in we:scripts/operations/__tests__/helpers/real-repo.mjs supplies a local origin and repository-local git identity.
- **Corrected scope:** retain we:scripts/operations/__tests__/run.test.mjs for the local helper and all matching executable regressions; add we:docs/agent/delivery-loop.md for the explicit positive-control review checklist. Its existing “Writing the mandate” mutation instruction is general, without the unconditional-refusal control check. Production CLI behavior and the shared git fixture helper are evidence, not edit targets. No new production source file is needed, so the scoped existing test file covers every executable change.
- This preparation is source inspection, not a claim that the proposed regressions or mutations have been run. The runner owns preparation stamping and checks.

## Design

Keep both owed guards within the existing test harness and review guidance.

1. In we:scripts/operations/__tests__/run.test.mjs, make the fresh-checkout control invoke `dispatch-lane` without `--num` or `--help`. Assert the specific missing-`num` parse diagnostic, exit code 2, no preflight refusal, and empty run/call stores. This deliberately reaches preflight and then stops at argument validation, before dispatch effects. Preserve the stale detached-checkout test and its refusal assertion. Help may remain a separately named usage smoke test, but cannot serve as the preflight control.
2. Make the local `runCli` helper own an explicit environment object: inherit only PATH; create HOME beneath the fixture temporary root; set OPERATION_RUNS_DIR and OPERATION_CALLS_DIR to the fixture stores. Do not spread the parent environment or inherit GH, GitHub, agent/provider, Node injection, or alternate config-directory variables. Keep using `process.execPath` for Node and the fixture clone as cwd. A local environment builder may be factored within the same test file so tests can pass a synthetic parent environment without mutating global state.
3. Add the specific review-lens check to “Writing the mandate” in we:docs/agent/delivery-loop.md: for a positive control paired with a refusal test, force the guarded behavior to refuse unconditionally and require the named positive control to redden. Verify that it reaches the guarded branch rather than returning through help/usage first. Record the mutation and result; do not add a repository-wide mutation gate or a regex lint rule.

## MVP

- Update the local helper, fresh-control invocation, and assertions in we:scripts/operations/__tests__/run.test.mjs. Return call-store records as well as run-store records so both early exits prove zero persisted work.
- Add allowlist regression cases in that same file. Supply a synthetic parent containing PATH plus dummy GH_TOKEN, GITHUB_TOKEN, OPENAI_API_KEY, ANTHROPIC_API_KEY, NODE_OPTIONS, XDG_CONFIG_HOME, and an arbitrary unrecognized variable. Assert exact environment keys and fixture-local values, not merely absence of a few known secrets.
- Exercise the environment through a harmless child probe using the same helper-owned spawn options; inspect the child's environment to prove the spawn uses the allowlist. Keep the probe inside the fixture and out of the production CLI. This catches an environment-builder test passing while the actual spawn still spreads the parent.
- Add the review checklist sentence in we:docs/agent/delivery-loop.md. No dispatch policy, CLI API, shared-fixture migration, or new lint subsystem is required.

## Test plan

Matching executable test file: we:scripts/operations/__tests__/run.test.mjs. Run it with Vitest from the WE repository root (the `npx vitest run` command with that repository-relative test path).

Cover:

- Fresh local origin/main: reaches missing-`num` argument validation, status 2, no stale/refusal message, no run or call records.
- Stale detached checkout after a code-file advance on the local origin: status 1, stale/refusal diagnostic, no run or call records.
- Exact environment allowlist with dummy credentials and unrelated parent variables; HOME and both stores resolve beneath the fixture root and HOME exists.
- A real harmless child receives the intended environment through the same spawn path used by `runCli`; no parent credentials or injection/config variables survive.
- Spawn errors/timeouts fail with a useful diagnostic rather than being mistaken for a successful early exit. Retain fixture cleanup on failure.

The documentation change is manually reviewed against the mutation evidence; no test that only searches for checklist wording is needed.

## Proof plan

1. Before fixing the control, mutate only the copied fixture's we:scripts/operations/run.mjs so `cliPreflight` throws an unconditional, recognizable refusal. Demonstrate that the old help-based control still passes: it bypasses the guard. Do not mutate the working production entry point or start a real dispatcher.
2. With the corrected control and isolated environment, repeat the same mutation: the named fresh-checkout control must fail on status/diagnostic expectations. Restore the fixture and show it passes.
3. Delete the CLI's `cliPreflight(name)` call in a copied fixture and require the stale-checkout test to fail. Use missing-`num` arguments for this mutation probe so bypassing preflight stops at parsing instead of entering dispatch. The unmutated stale fixture must still refuse before parsing.
4. Temporarily restore parent-environment spreading in the test helper; require the exact-key/real-child regression to fail with dummy sentinel data, then restore the allowlist and obtain green. Never log real credentials.
5. Record named tests, commands, exit results, and mutation outcomes in delivery evidence. Run `npm run check:standards` and the affected Vitest test before delivery. The checklist must explicitly cover the unconditional-refusal mutation; a green ordinary run alone does not discharge that debt.

## Done when

Both owed prevention guards are implemented: a real preflight positive control demonstrably fails under unconditional refusal, the review checklist requests that proof, and spawned CLI fixtures demonstrably receive only the helper's allowlisted environment. The environment regression is the executable red-before/green-after witness; the repaired control has its own mutation witness. Both fresh and stale paths leave run/call stores empty.

## Follow-ups

None required for this item. A broader migration of other operation-CLI fixtures or a lint rule is outside this bounded guard; the original review explicitly permits helper ownership. Do not turn this into a shared-fixture or production-environment redesign.
