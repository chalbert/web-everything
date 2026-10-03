---
bornAs: x1kcwxs
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/reconcile-pass.mjs", "we:scripts/conveyor/reconcile-core.mjs", "we:scripts/conveyor/reconcile-fix-dispatch.mjs", "we:scripts/conveyor/__tests__/reconcile-pass.test.mjs", "we:scripts/conveyor/__tests__/reconcile-core.test.mjs", "we:scripts/conveyor/__tests__/reconcile-fix-dispatch.test.mjs"]
dateOpened: "2026-10-01"
preparedDate: "2026-10-02"
preparedAgainstSha: "35f85c0f1d9f7c7ff718fa927f00ca12dd248b78"
tags: []
---

# Prevention — Pin capped PR files, creation-based aging, and conservative empty overlap scopes

Filed mechanically on approval of chalbert/web-everything#3420. Preserve the three prevention goals: verify the public pass snapshot, connect marker-less aging to ranking, and prevent an empty overlap array from removing a claim's protection.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3420@90c0f319048c6053342540a81cd38cf9b97d67ed

## Progress

- Original premise/scope: add a capped/ordinary `openPrFiles` assertion at old `we:scripts/conveyor/reconcile-pass.mjs:1039`, optionally share the three file-cap checks; add marker-less ranking coverage at old `we:scripts/conveyor/reconcile-core.mjs:2218`; cover empty overlap scope at both claim acquisitions and refresh, citing `we:scripts/conveyor/reconcile-fix-dispatch.mjs:740`. The six declared source/test paths still exist.
- Corrected premise: the pass projection is now at `we:scripts/conveyor/reconcile-pass.mjs:1119`; core file projection is at `we:scripts/conveyor/reconcile-core.mjs:1442`, and creation-time fallback is at `we:scripts/conveyor/reconcile-core.mjs:2259`. Creation-based aging is already deliberate in the adjacent starvation comment, not an unresolved policy choice.
- Existing evidence: `we:scripts/conveyor/__tests__/reconcile-core.test.mjs:3155` covers marker-less creation time and capped files. `we:scripts/conveyor/__tests__/reconcile-fix-dispatch.test.mjs:1468` covers the 24-hour ranking threshold using manually supplied waiting times; its case at line 1487 covers a capped snapshot's full-diff fallback. These do not connect marker-less core output to ranking, and `we:scripts/conveyor/__tests__/reconcile-pass.test.mjs` has no `openPrFiles` assertion. This goal is not already delivered.
- Corrected implementation scope: the acquisitions remain at `we:scripts/conveyor/reconcile-fix-dispatch.mjs:740` and line 908. Refresh at line 1148 accepts an empty array because it is truthy; queue scope selection at line 1492 also accepts it through `??`. Include that queue selector in the same conservative-empty fix, without adding files. Existing refresh tests at `we:scripts/conveyor/__tests__/reconcile-fix-dispatch.test.mjs:1432` cover nonempty observations, not empty observations. All three source entries retain matching test entries in frontmatter.
- Preparation is based on source/test inspection; no implementation or test execution is claimed here. Stamping and checks belong to the runner.

## Design

Retain the current interfaces and ranking policy. `runReconcilePass` must return `openPrFiles` for every raw open PR: ordinary arrays become path strings, and arrays with at least 100 entries or absent file observations become `null`. The cap means incomplete evidence, never permission to narrow a claim. Assert this public output using injected readers in `we:scripts/conveyor/__tests__/reconcile-pass.test.mjs`.

Keep creation time as the waiting-age fallback when no review episode exists in `we:scripts/conveyor/reconcile-core.mjs`. Document that this intentionally bounds starvation even for an old PR whose fix became eligible recently. A real episode still takes precedence. Connect `planReconcile` output through `planFixesFromReconcile` to `filterFixesByInFlightScope` in `we:scripts/conveyor/__tests__/reconcile-fix-dispatch.test.mjs`, with a fixed clock: a marker-less PR aged 24 hours precedes a fresh higher-fan-out contender; at 23 hours a sufficiently high fan-out contender wins.

In `we:scripts/conveyor/reconcile-fix-dispatch.mjs`, use a nonempty overlap array when available, otherwise the declared scope, consistently in `tryResumeFix`, `dispatchFix`, and `filterFixesByInFlightScope`. During claim refresh, replace an existing claim scope only with a nonempty observed scope; an empty, missing, or failed observation preserves the existing fence. Keep nonempty actual-diff narrowing intact. Existing no-scope and scope-read-failed planning refusals remain intact; do not introduce a global lint rule or change claim storage.

## MVP

1. Add direct pass-output coverage in `we:scripts/conveyor/__tests__/reconcile-pass.test.mjs` for ordinary and exactly-100-file PRs in the same read, including an open PR that is not dispatched.
2. Preserve and clarify creation fallback in `we:scripts/conveyor/reconcile-core.mjs`; extend `we:scripts/conveyor/__tests__/reconcile-core.test.mjs` to pin episode precedence over an older creation date. Add the connected ranking case in `we:scripts/conveyor/__tests__/reconcile-fix-dispatch.test.mjs`.
3. Apply a local shared nonempty-scope selector in `we:scripts/conveyor/reconcile-fix-dispatch.mjs` to the two claim callers and queue filter; guard refresh against empty replacement scopes. Add regressions using existing injectable claim, dispatch, diff-reader, and session seams.

The shared file-cap helper is optional review advice, not required for this MVP. Keep the three current conversions unchanged and pin their observable behavior; avoid introducing another source/test pair for a refactor unrelated to the empty-scope defect.

## Test plan

- `we:scripts/conveyor/__tests__/reconcile-pass.test.mjs`: assert exact PR-number/path association for ordinary string and object entries, 99-file acceptance, 100-file and over-cap `null`, missing observations as `null`, and empty arrays preserved in the snapshot. Inject all external readers/enrichers so this test neither calls GitHub nor starts agents.
- `we:scripts/conveyor/__tests__/reconcile-core.test.mjs`: retain the existing capped/marker-less test and verify an episode overrides old creation time. Keep cap behavior consistent with the pass.
- `we:scripts/conveyor/__tests__/reconcile-fix-dispatch.test.mjs`: pass actual core-produced waiting times through planning and ranking. Assert winner and ranks at 23/24 hours under reversed input order, with enough distinct fresh overlapping waiters to beat 23 age points.
- In the same dispatch test file, spy on `acquireClaim` for both resume and fresh dispatch. For empty, absent, and null overlap scope assert the declared fence is supplied; for a nonempty actual scope assert it takes precedence. Arrange a valid resume candidate so the resume test reaches acquisition.
- Exercise queue filtering and refresh through `runReconcileFixDispatch`: an empty snapshot, an empty full-diff read, and an empty planned overlap must preserve an existing overlapping claim and prevent dispatch. Retain coverage for failed reads, foreign claims, and nonempty narrowing. Repeat representative overlap cases with source, documentation, configuration, and data paths; no file category gains a bypass.

## Proof plan

Run the affected Vitest suite from the WE checkout: `npx vitest run` with the three scope-listed test files (`we:scripts/conveyor/__tests__/reconcile-pass.test.mjs`, `we:scripts/conveyor/__tests__/reconcile-core.test.mjs`, `we:scripts/conveyor/__tests__/reconcile-fix-dispatch.test.mjs`), removing the repository prefix only when supplying filesystem arguments.

Record a red/green result: the new empty-array acquisition/refresh/filter cases must fail against the current implementation and pass after the fix. The pass-output and ranking cases may pass initially because they cover existing behavior; demonstrate their sensitivity with temporary local mutations accepting the 100-file snapshot and removing creation-time fallback, then restore those mutations. Capture failing test names and final counts. Run `npm run check:standards` after implementation. Use only injected local observations; live claims and agent sessions are not part of this proof.

## Done when

- Must expose `null` for capped file snapshots while retaining ordinary PR paths in the public pass output.
- Must pin creation-based starvation protection through the real core-to-ranking chain without changing its 24-hour threshold.
- Must never replace a nonempty declared/live fence with an empty overlap observation at either claim caller, refresh, or queue filtering; failed reads remain conservative.
- Must preserve protection for documentation, configuration, and data as well as source paths, while still narrowing to a nonempty actual diff.
- The three affected suites and standards gate pass, with the red/green and mutation evidence recorded.

## Follow-ups

No follow-up blocks this bounded prevention work. A shared file-cap helper can be a separate refactor if later changes warrant it; a general lint prohibition on nullish scope-array fallback is outside this item. Neither is needed to satisfy the three original guards.
