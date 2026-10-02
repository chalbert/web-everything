---
bornAs: xagx4bt
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/__tests__/reconcile-pass.test.mjs"]
dateOpened: "2026-09-29"
preparedDate: "2026-10-02"
preparedAgainstSha: "c9cddb03988f9433ee9beb96c21f91011dfc6a6e"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2990's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/conveyor/__tests__/reconcile-pass.test.mjs:36` — Inject `readRequiredChecks: () => ({checks: [...], source: 'fallback'})` in this test, or assert `requiredChecks: expect.any(Array)`. Longer term, add a test-helper or lint rule that forbids calling `runReconcilePass` without `readRequiredChecks` injected.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2990@470fb72cc552e8b14470938124d8a947cf4610e9

## Progress

Preparation research found partial mitigation, not delivery. The original premise cited
`we:scripts/conveyor/__tests__/reconcile-pass.test.mjs:36` and requested an injected
required-check reader or an array-shape assertion, with a broader helper/lint guard as longer-term work.
Commit `092a61f5b5d83b08a9faa8cb102cc012aff6d5bd` replaced exact equality with
`expect.arrayContaining(['test', 'smoke', 'daemon-soak'])`. The current normalization test is at
`we:scripts/conveyor/__tests__/reconcile-pass.test.mjs:27-45`; it still omits `readRequiredChecks`.
The old line 36 now falls in explanatory comments, not the assertion.

Corrected premise: accepting a superset mitigates extra cached checks but still couples this unit test
to the checkout's cache and assumes all fallback names remain required. The comments describe a
host-level cache; `defaultCachePath` in `we:scripts/lib/required-status-checks.mjs` actually resolves
`we:reports/.required-status-checks-cache.json` relative to the working directory.
`getRequiredStatusChecks` accepts any valid matching fresh cache and can use a stale cache after a
failed fetch; it does not require the cached list to contain the fallback names. Mocking child-process
execution in the test does not mock those filesystem reads.

Source evidence: `we:scripts/conveyor/reconcile-pass.mjs:992` defaults `readRequiredChecks` to
`getRequiredStatusChecks`; `we:scripts/conveyor/reconcile-pass.mjs:1018-1024` calls it with the
normalized repo and passes its checks to `enrichMainRed`. The adjacent required-set threading test in
`we:scripts/conveyor/__tests__/reconcile-pass.test.mjs` already demonstrates the injectable reader.
The reader's cache behavior has its own tests in `we:scripts/lib/__tests__/required-status-checks.test.mjs`.

Scope remains the existing test file only: replace the normalization test's environmental dependency
with an explicit fixture and executable assertions that require its use. No production source changes
are needed, so the scope already names the matching test. A repository-wide enforcement rule remains
longer-term work as originally stated. Research here is source/history inspection; no test execution
or implementation is claimed by this preparation.

## Design

In the normalization test in `we:scripts/conveyor/__tests__/reconcile-pass.test.mjs`, create a local
`vi.fn` reader returning `{ checks: ['fixture-required-check'], source: 'fallback' }` and pass it as
`readRequiredChecks` to `runReconcilePass`. A deliberately synthetic check name distinguishes the
fixture from any real branch-protection policy. Keep the existing normalized `readPrs` assertion and
assert that the injected reader is called exactly once with
`{ repo: 'chalbert/web-everything', branch: 'main' }`. Assert the exact fixture checks in the
`enrichMainRed` call, alongside its normalized repo and default branch.

These assertions make omission of the injection detectable even if the environment happens to return
an acceptable list: the injected reader would have zero calls. Replace the cache-dependent comments
with an explanation of the explicit fixture. The production reader, fallback policy, cache behavior,
and shared test helper are unchanged.

## MVP

1. Update the single normalization test in `we:scripts/conveyor/__tests__/reconcile-pass.test.mjs`
   with the fixture reader, injection, invocation-count and argument assertions, and exact enrichment assertion.
2. Remove the comments that justify relying on a cached superset.
3. Deliver one test-only change with focused passing results and the omission-mutation result below.

## Test plan

Run the normalization case from `we:scripts/conveyor/__tests__/reconcile-pass.test.mjs` with Vitest's
`-t 'normalises a bare repo KEY'` filter, then run that entire test file to check interaction with its
module mocks and shared contract tests. Use `npx vitest run` with the WE-relative form of that file
path (strip the documentation's `we:` prefix when invoking the command).

Verify the reader is called once, receives the normalized slug and main branch, and supplies exactly
`['fixture-required-check']` to enrichment. No real cache editing, credentials, or network access is
needed for the targeted case. Production cache-policy tests in
`we:scripts/lib/__tests__/required-status-checks.test.mjs` are evidence of the separate reader contract,
not an additional implementation target.

## Proof plan

For a deterministic red/green demonstration, add the fixture and its assertions before adding the
`readRequiredChecks` option: the focused test must fail because the fixture reader was not called.
Add the option and rerun: the same case must pass. Afterward temporarily remove only that option and
confirm the focused case fails again; restore it and rerun the complete test file. Record the actual
assertion failure and commands in implementation evidence. This proves the guard detects omission
without relying on the current cache contents or claiming the unmodified baseline always fails.
Run the standard consistency gate for the implementation as well; the preparation runner owns this
card's stamping and checks.

## Follow-ups

The originally suggested shared helper or lint rule forbidding uninjected reconciliation calls remains
optional longer-term prevention, outside this bounded fix. Before implementing it, audit calls in
`we:scripts/conveyor/__tests__/reconcile-pass.test.mjs` and the shared contract harness in
`we:scripts/conveyor/__tests__/pr-file-test-helpers.mjs`, distinguishing intentional default-reader
coverage from unit cases needing isolation. Do not expand this item into a global policy change.

## Done when

1. The normalization test explicitly supplies its required-check fixture and asserts its single normalized call.
2. Its enrichment assertion matches the fixture exactly, without depending on cached fallback membership.
3. The focused omission mutation fails, the restored full test file passes, and implementation evidence records both.
