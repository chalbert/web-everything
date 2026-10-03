---
kind: story
size: 2
status: open
scope: ["we:scripts/conveyor/reconcile-pass.mjs", "we:scripts/conveyor/__tests__/reconcile-pass.test.mjs"]
dateOpened: "2026-10-02"
preparedDate: "2026-10-03"
preparedAgainstSha: "8ea8162831244061921931ff25ea3bfaafbd67c4"
tags: []
---

# The disjoint-closure check can miss a deleted dependency

Follow-up from the #3559 advisory (2026-10-02). The head-only dependency walk in `we:scripts/conveyor/reconcile-pass.mjs#timeoutImpact` can accept a failing test as untouched when deleting a source dependency changes extensionless import resolution to an unchanged fallback. Conservatively refuse timeout-rerun eligibility for any source deletion; comparing resolution against the base is outside this item.

## Design

In `we:scripts/conveyor/reconcile-pass.mjs#timeoutImpact`, inspect the changed-file records for GitHub's `status: removed` before walking the head closure. After the existing head/root binding and changed-input category checks, return a deterministic refusal such as `deleted-source-impact-unknown:<path>` for the first removed source. This applies even when the deleted source is unreachable in the head tree: head-only reachability cannot prove it was unreachable before deletion.

Keep the current traversal, rename old-path intersection, immutable head-bound sources, and classifier result shape. `we:scripts/conveyor/reconcile-pass.mjs#readTimeoutEvidence` already forwards complete GitHub file records, including status, to the classifier; no additional API reads or base-tree resolver are needed. Do not infer deletion merely from absence in the lazy source map.

## MVP

1. Add the removed-source refusal to `we:scripts/conveyor/reconcile-pass.mjs#timeoutImpact`.
2. Add classifier regressions and an injected-reader regression in the existing `we:scripts/conveyor/__tests__/reconcile-pass.test.mjs` timeout-evidence coverage.
3. Preserve eligibility for a genuinely disjoint modified source and preserve all existing uncertainty refusals. No changes to retry budgets, dispatch policy, or the opt-in rollout flag.

## Done when

- **Must refuse:** a complete, correctly bound timeout inventory whose changed-file list contains a removed source, including a deletion that selects an unchanged resolution fallback.
- **Must preserve:** incomplete/error evidence remains ineligible; documentation, config, setup, fixture, data, lockfile, and workflow changes retain their existing cautious treatment.
- **Executable:** from the WE checkout, run `npx vitest run` against `we:scripts/conveyor/__tests__/reconcile-pass.test.mjs`, with `-t x9mr5is`. The new fallback regression must fail before the guard and pass after it; run the full file afterward to check existing behavior.

## Test plan

All new cases belong in `we:scripts/conveyor/__tests__/reconcile-pass.test.mjs`, with `x9mr5is` in their names.

- Build complete classifier evidence using the existing timeout fixture. Make the failing test statically import an extensionless leaf; supply only its JavaScript fallback in the head source map and report its TypeScript predecessor as removed. Assert `eligible: false` and the deletion-specific reason. Today the candidate search skips the absent predecessor and accepts the fallback.
- Cover a removed direct dependency without a fallback and a removed source unrelated to the head closure. Both must refuse; the latter proves the deliberately conservative scope.
- Include a transitive extensionless dependency and a file-to-index fallback, both with the removed predecessor absent from the head source map.
- Keep a positive control with a disjoint modified source. Retain existing old-name rename coverage and the non-source/config/setup/fixture and incomplete-evidence refusal matrix.
- Extend the injected GitHub reader fixture to return a removed source record plus a fallback-only head tree. Assert `readTimeoutEvidence` returns ineligible, proving status survives collection and the real classifier receives it. Use injected reads only, with no network or rerun side effects.

## Proof plan

Capture the new classifier fallback test failing on the pre-fix implementation because it returns eligible, then passing with the guard. Record the focused run and full affected-file run, including the injected-reader case and positive control. The implementation runner should also run `npm run check:standards`. These deterministic probes prove the refusal boundary without rerunning an actual CI job or changing production enablement.

Preparation observation: a direct Node call to `we:scripts/conveyor/reconcile-pass.mjs#timeoutImpact` with an extensionless test import, a removed TypeScript leaf, and only its JavaScript fallback in the head map returned `null` (no refusal). This establishes the current unsafe impact result; the planned classifier test supplies the complete job/inventory evidence around it.

## Follow-ups

A future relaxation could compare base and head resolution before allowing particular deletions. That requires separate work and proof; this item intentionally keeps every source deletion ineligible. Rename-induced resolution changes beyond the existing old-path intersection are also outside this deletion-specific guard and should be investigated separately, without weakening the refusal here.

## Progress

- **Old premise/scope:** the title said the check treats a deleted dependency as touching the failing test, while the body described the opposite defect and cited `we:scripts/conveyor/reconcile-pass.mjs:1257`. Scope named `we:scripts/conveyor/reconcile-pass.mjs` and `we:scripts/conveyor/__tests__/reconcile-pass.test.mjs`.
- **Corrected premise/scope:** the check can miss a deletion when head resolution finds an unchanged fallback. Keep the same source/test scope; the remedy is a status-based conservative refusal, not a new base-resolution subsystem. The title now matches the original goal.
- **Source evidence:** `we:scripts/conveyor/reconcile-pass.mjs:1207` starts `timeoutImpact`; its changed-path list drops status, and the candidate search at `we:scripts/conveyor/reconcile-pass.mjs:1257` resolves exclusively against the head map. `we:scripts/conveyor/reconcile-pass.mjs:1309` collects full changed-file records, and `we:scripts/conveyor/reconcile-pass.mjs:1364` passes them into classification. Existing coverage starts at `we:scripts/conveyor/__tests__/reconcile-pass.test.mjs:802`; the missing-dependency case at `we:scripts/conveyor/__tests__/reconcile-pass.test.mjs:860` has no fallback and therefore does not cover this defect. The direct preparation probe returned no refusal for a removed predecessor with an available fallback. The goal is not already delivered.
