---
bornAs: x1dcx1d
kind: story
size: 3
tier: pinned
status: resolved
scope: ["we:scripts/conveyor/reconcile-pass.mjs", "we:scripts/conveyor/main-red-recovery.mjs"]
dateOpened: "2026-09-29"
dateStarted: "2026-09-29"
dateResolved: "2026-09-29"
preparedDate: "2026-09-29"
preparedAgainstSha: "c72a6b765d1fd2fc58f35328460f01c382c6d566"
tags: []
---

# CI-heal treats a red soak-replay-gate as red

The fix/ci-heal daemons classify `ci-red` only from `DEFAULT_MAIN_RED_ATTRIBUTED_CHECKS = ['test', 'smoke', 'daemon-soak']` in `we:scripts/conveyor/main-red-recovery.mjs` (consumed by `we:scripts/conveyor/reconcile-core.mjs`). `soak-replay-gate` is not in that list, and it is also not in the repo's branch-protection required-checks list, so a PR that is red ONLY on `soak-replay-gate` reads green to the daemons — nothing gets dispatched to fix it — while the drain still refuses to merge it because that check is red. The PR stalls with no automated path forward.

## Premise check (2026-09-29, against live main + live GitHub)

Confirmed still broken: `DEFAULT_MAIN_RED_ATTRIBUTED_CHECKS` on `main` is still the hardcoded `['test','smoke','daemon-soak']` (`we:scripts/conveyor/main-red-recovery.mjs`). One correction to the premise: GitHub branch protection on `chalbert/web-everything`'s `main` has SINCE been updated (operator action, out of this item's scope) to `["test","smoke","daemon-soak","soak-replay-gate"]` — so `soak-replay-gate` IS now a live-required check. That partially heals the symptom for the ONE consumer that already reads branch protection live (`we:scripts/lib/required-status-checks.mjs#getRequiredStatusChecks`, threaded into `we:scripts/conveyor/reconcile-core.mjs#planReconcile`'s `reduceCheckState` CI-truth call, and separately into `we:scripts/conveyor/ci-red-recovery-watch.mjs#sweepCiRedRecovery` via its own `readRequiredContexts`) — both of those already correctly see `soak-replay-gate` as required today. The bug survives in the ONE place that still bypasses that live read entirely: `we:scripts/conveyor/reconcile-pass.mjs#runReconcilePass` calls `enrichPrsWithMainRedFacts` (the function that attaches `requiredCheckName`/`requiredCheckCompletedAt`/`aheadByOnMain` — the facts `isPrCiFailureOwedRerun` needs to tell "this red was main's fault" apart from "this PR owns it") BEFORE it live-fetches `requiredChecks`, and never passes that fetched value into it — so that one call silently keeps falling back to the hardcoded three-check list, forever missing `soak-replay-gate` (and any future check added to branch protection) even though the very next line in the same function fetches the correct live list for a sibling consumer (`planReconcile`). This is the exact "two independently maintained sources of truth, already drifted, will drift again" the Design section names — just resolved to precisely one wiring gap.

## Scope check

Corrected `scope:` to the real touch-set: `we:scripts/conveyor/reconcile-pass.mjs` (the caller that must thread the already-live-fetched `requiredChecks` into `enrichPrsWithMainRedFacts`) and `we:scripts/conveyor/main-red-recovery.mjs` (the hardcoded fallback default). `we:scripts/conveyor/reconcile-core.mjs` needs NO change — it already receives and correctly uses the live `requiredChecks` for its own CI-truth read (`reduceCheckState`); it was only ever a downstream READER of the facts `enrichPrsWithMainRedFacts` attaches, never the place the list is hardcoded.

## Design

Two independently-maintained "what's required" constants existed with byte-identical values today (`we:scripts/conveyor/main-red-recovery.mjs#DEFAULT_MAIN_RED_ATTRIBUTED_CHECKS` and `we:scripts/lib/required-status-checks.mjs#FALLBACK_REQUIRED_STATUS_CHECKS`, both `['test','smoke','daemon-soak']`) — coincidence, not a guarantee. Fix: make the FALLBACK constant a single import (so the two can never silently diverge again), and thread the ALREADY-LIVE-FETCHED `requiredChecks` (that `runReconcilePass` fetches one line below where it currently ignores it) into `enrichPrsWithMainRedFacts`, exactly the way it is already threaded into `planReconcile` two lines later.

## MVP

- `we:scripts/conveyor/main-red-recovery.mjs`: import `FALLBACK_REQUIRED_STATUS_CHECKS` from `we:scripts/lib/required-status-checks.mjs` and define `DEFAULT_MAIN_RED_ATTRIBUTED_CHECKS` from it, instead of a second hardcoded literal.
- `we:scripts/conveyor/reconcile-pass.mjs#runReconcilePass`: move the `readRequiredChecks(...)` call ahead of the `enrichMainRed(...)` call, and pass the resolved `requiredChecks` into `enrichMainRed(rawPrs, { repo: resolvedRepo, defaultBranch, requiredChecks })`.
- Keep the change narrow: no change to `failingRequiredCheckForAttribution`/`isAnyRequiredCheckFailed`'s own logic (they already accept an injected `requiredChecks`) and no change to `we:scripts/conveyor/reconcile-core.mjs`.

## Test plan

- Unit test: `enrichPrsWithMainRedFacts` given `requiredChecks` including `soak-replay-gate`, and a PR red ONLY on `soak-replay-gate`, now attaches `requiredCheckName`/`requiredCheckCompletedAt` (today it silently skips this PR — `isAnyRequiredCheckFailed` never even looks at that check name).
- Wiring test: `runReconcilePass`, given an injected `readRequiredChecks` that returns a set including `soak-replay-gate`, calls its injected `enrichMainRed` with that same set in `requiredChecks` (proves the caller actually threads it, not just that the callee can accept it).
- Regression test (already exists, `we:scripts/conveyor/__tests__/main-red-recovery.test.mjs`): `DEFAULT_MAIN_RED_ATTRIBUTED_CHECKS` still equals `['test','smoke','daemon-soak']` by value — no behavior change for the existing cases when no live fetch is available.
- Agreement: `DEFAULT_MAIN_RED_ATTRIBUTED_CHECKS` and `FALLBACK_REQUIRED_STATUS_CHECKS` are now the SAME imported binding (stronger than a separate agreement test — they cannot diverge without both call sites changing together).

## Proof plan (soak break)

- Live case used: PR #2939 (chalbert/web-everything, MERGED), CI run `36599015675` — real `statusCheckRollup` showing `soak-replay-gate` FAILURE at `2026-09-29T16:39:42Z` while `test`/`smoke`/`daemon-soak` were all SUCCESS at that same point in the PR's history (it later recovered on a re-run at `17:57:12Z` and merged).
- Before: feed that exact real rollup shape through `enrichPrsWithMainRedFacts` with the OLD hardcoded default — `isAnyRequiredCheckFailed` returns `false`, no attribution facts attached, this PR is invisible to the main-red-attribution path.
- After: same input, `requiredChecks` now includes `soak-replay-gate` (as it live-does today) — `isAnyRequiredCheckFailed` returns `true` and `failingRequiredCheckForAttribution` names `soak-replay-gate`.

## Follow-ups

- File: audit `we:scripts/conveyor/ci-red-recovery-watch.mjs`'s OTHER hardcoded list, `DEFAULT_REQUIRED_CONTEXTS` (used by `buildMissingRunCandidates`, currently `['test']` only) for the same drift risk — separate mechanism (missing-run detection, not red-attribution), explicitly out of this item's narrow MVP.
- Consider whether `soak-replay-gate` should also be added to GitHub branch protection's required-checks list directly — a repo-settings change; live-confirmed 2026-09-29 this has ALREADY been done (branch protection's `required_status_checks.contexts` now includes it), so this follow-up is resolved in practice, not by this PR's code.

## Done when

1. **Executable** — these three named tests (the ones that actually differ pre/post-fix — the other two new enrichment tests pass on either side of this change, since they inject `requiredChecks` explicitly) fail before this item lands and pass after (converge round 1 finding, standards-conformance/claim-accuracy lenses):

```bash
npx vitest run scripts/conveyor/__tests__/reconcile-pass.test.mjs scripts/conveyor/__tests__/main-red-recovery.test.mjs \
  -t "threads the live-fetched requiredChecks|SAME binding as required-status-checks|normalises a bare repo KEY"
```
