---
bornAs: x9e5920
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/reconcile-pass.mjs", "we:scripts/conveyor/__tests__/reconcile-pass.test.mjs"]
dateOpened: "2026-10-02"
preparedDate: "2026-10-03"
preparedAgainstSha: "7abf0a58f0e62f1f439de96bd5139f6cc689ad3e"
tags: []
---

# Prevention — REST check rows take precedence over the snapshot after a successful read

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/conveyor/reconcile-pass.mjs#hydrateChecks` — Add a reconcile-pass regression test asserting REST rows take precedence over the snapshot whenever the REST read succeeded. Restrict the `known` fallback to `result.error` only.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3432@07a3f88b3754b6d514d839a671ca102d770b92d0

## Progress

- Original premise/scope: the approval follow-up pointed to line 1031 of `we:scripts/conveyor/reconcile-pass.mjs` and requested REST precedence plus a regression in `we:scripts/conveyor/__tests__/reconcile-pass.test.mjs`.
- Checked premise: the defect remains in `we:scripts/conveyor/reconcile-pass.mjs:1027` through the rollup selection at `we:scripts/conveyor/reconcile-pass.mjs:1040`. `refused` combines `result.error` and `result.incomplete`; using `refused && known` therefore restores stale red/pending snapshot rows even when validated REST rows were returned successfully. The old line citation now points inside refusal reporting, not the selection expression.
- Corrected scope: retain the same source/test pair, but explicitly update an existing contradictory expectation as well as add regression coverage. `we:scripts/conveyor/__tests__/reconcile-pass.test.mjs:1041` parameterizes both an unreadable read and successfully read absent evidence as reasons to retain a cancelled snapshot. Only the unreadable case should retain it. Existing pending/error and green/error controls follow at `we:scripts/conveyor/__tests__/reconcile-pass.test.mjs:1054`. This is unfinished behavior and regression work, not an already-delivered goal.

## Design

In `we:scripts/conveyor/reconcile-pass.mjs#hydrateChecks`, distinguish failure to obtain usable REST evidence from successfully obtained evidence that lacks required names. Select the rollup as `result.error ? (known ?? []) : result.rows`. Keep `known` limited to the existing red/pending snapshot classification. Successful validated REST reads always supply the rollup, including empty arrays and partial successful rows; they never merge with or fall back to snapshot rows.

Retain the existing `result.error ?? result.incomplete` refusal reporting. Successful incomplete evidence still emits `check-read-failed` and stays unchecked when the observed REST rows contain no required red/pending evidence. Successful REST rows containing required red/pending evidence retain the existing reducer behavior even if other required names are absent. Transport failures, malformed rows, and unreadable required conclusions remain errors and may preserve known snapshot red/pending evidence. A green snapshot cannot turn an error into permission to promote.

Update the adjacent source comment to describe error-only fallback. No reader API, reducer policy, hydration trigger, per-head cache, or refusal vocabulary change is needed.

## MVP

1. Change the rollup selection and explanatory comment in `we:scripts/conveyor/reconcile-pass.mjs#hydrateChecks`.
2. In `we:scripts/conveyor/__tests__/reconcile-pass.test.mjs`, split the existing cancelled-snapshot parameterized test: retain its error fallback assertion, and replace the successful absent-evidence expectation with no CI heal or draft promotion.
3. Add a table-driven REST-precedence regression using the existing injected `runReconcilePass` readers and hydration fixtures. Capture the hydrated rollup through injected `enrichMainRed` as well as asserting planner output, so pending and unchecked cannot pass merely because both dispatch nothing.

## Test plan

All new or changed cases belong in `we:scripts/conveyor/__tests__/reconcile-pass.test.mjs`, the matching test file for the sole source entry in scope.

- Cross stale snapshot cancellation and pending states with successful REST responses containing (a) no rows and (b) only a successful required check, with other required names absent. Assert the downstream rollup equals the normalized REST rows, one visible `check-read-failed` refusal, and neither `ci-heal` nor `promote-draft` for that PR. These cases must fail against the current fallback expression.
- Supply all required REST checks as successful against the same stale snapshots; assert REST rows reach enrichment, promotion is planned for the draft fixture, and no hydration refusal occurs.
- Preserve successful partial REST cancellation/pending behavior: authoritative observed cancellation can heal; pending cannot promote. Neither case restores conflicting snapshot rows.
- Preserve error controls for thrown reads and malformed/unreadable rows: known cancellation survives and can heal with a visible refusal; known pending survives; truncated green evidence becomes an empty rollup and cannot promote. Inspect the rollup for the pending case.
- Exercise successful incomplete evidence for source, docs, configuration, and data change fixtures. File kind must not bypass the precedence rule or permit promotion with missing required evidence.
- Retain existing checks for exact-head read arguments, same-head deduplication, independent PR progress, and non-CI planning after hydration refusal.

## Proof plan

The implementation worker runs targeted Vitest coverage through `npx vitest run` with `we:scripts/conveyor/__tests__/reconcile-pass.test.mjs` as the target (strip the repository prefix when passing the local filename). First add/update the regression assertions and run against the unchanged source: record failures showing the stale snapshot reaching enrichment and the cancelled snapshot incorrectly scheduling CI heal. Then apply the selection fix and rerun the full target, including existing hydration controls.

For the green run, retain evidence of both the normalized downstream rows and the returned dispatch/refusal objects; absence of dispatch alone does not prove REST precedence. Run the neighboring `we:scripts/conveyor/__tests__/reconcile-pass-required-checks.test.mjs` with the same command to catch repo-local required-set regressions. Run `npm run check:standards` for the implementation diff. These are planned implementation proofs, not checks claimed as executed during preparation; the preparation runner owns stamping and its checks.

## Done when

1. **Must — success:** validated REST rows are the only hydrated rollup after a successful read, including successful empty/incomplete responses, and missing required evidence never promotes a draft.
2. **Must — error:** actual read/validation errors still emit a refusal, retain known red/pending snapshot evidence, and never promote from a truncated green snapshot.
3. **Must — input kinds:** source, docs, configuration, and data changes all obey the same evidence rule.
4. **Executable:** the targeted regression in `we:scripts/conveyor/__tests__/reconcile-pass.test.mjs` fails before the source fix and passes afterward; the full target and neighboring required-check suite pass.

## Follow-ups

None required for this bounded correction. Refusal naming, broader snapshot freshness policy, and changes to REST pagination or required-check discovery are outside this item; the existing error-versus-incomplete distinction suffices.
