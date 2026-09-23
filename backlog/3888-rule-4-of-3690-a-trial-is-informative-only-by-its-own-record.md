---
bornAs: xlbgizn
kind: story
size: 3
parent: "3383"
status: resolved
scaffoldedBy: "design-3784-supervision"
dateScaffolded: "2026-09-22"
scope: ["we:scripts/conveyor/log-delegation-trial.mjs", "we:scripts/conveyor/__tests__/log-delegation-trial.test.mjs", "we:scripts/lib/provider-routing.mjs", "we:scripts/lib/__tests__/provider-routing.test.mjs", "we:scripts/conveyor/run-scorecards.json"]
relatedTo: ["3690", "3784", "3717"]
dateOpened: "2026-09-22"
dateStarted: "2026-09-22"
dateResolved: "2026-09-22"
graduatedTo: none
tags: [dispatch, delegation, supervision, graduation]
---

# Rule 4 of #3690: a trial is informative only by its own recorded field, never inferred from outcome or findings

Rule 4 of we:docs/agent/platform-decisions.md#delegation-trial-record-graduation says a trial is the positive control only when a separate `informative` field on the row says so — meaning independent review found a real problem that was then fixed — and that it is never inferred from `outcome` (which means only "did this trial land") nor from the free-text `findings`. The code infers it. `isInformativeRecord` (we:scripts/lib/provider-routing.mjs:256) returns true for any verified row whose `outcome` is `rejected` or `reworked` and whose `findings` is a non-empty string. Add the field to the validated row shape and make the predicate read it.

**Home:** the prototype branch `lane/mechanical-dispatcher`. Both files also exist on `main`; the change is made to the branch copy, which the router reads there. Commit straight to the branch, no PR, one tracker note on #3383 per push; it reaches `main` through #3443.

**Order:** this is the FIRST of the three rule children carved by #3784's design settlement. `informative` is a recorded fact that rule 5's post-miss accounting reads and that rule 6's promotion batches are argued from, so it lands before them.

**What exists.** we:scripts/conveyor/log-delegation-trial.mjs validates a closed row shape (`outcome: ['landed', 'rejected', 'reworked']` at `:14`, a `findings` that must be a non-empty string or null at `:33`) and writes the row into we:scripts/conveyor/run-scorecards.json at `:80`. Nothing on that row records whether independent review found a real problem.

**The gap this closes, stated plainly.** Today a row whose delegated run was merely *reworked for an unrelated reason* counts as the positive control that unlocks `spot-check`, and a row where review found a real problem that was then fixed but which still landed counts as clean and not informative. Both readings are the ones rule 4 names as wrong.

**Not in this slice:** the `rootCause` field and the post-miss bar (rule 5, its own card, `blockedBy` this one); the promotion record and the enforcement flip (#3784).

## Done when

1. **Executable** — `npx vitest run we:scripts/conveyor/__tests__/log-delegation-trial.test.mjs` passes with new cases that fail before: (a) `--informative=true|false` is accepted and written onto the row; (b) a row omitting `informative` is written with an explicit `false` rather than absent, so no reader has to guess; (c) a non-boolean `informative` is refused by name.
2. **Executable** — `npx vitest run we:scripts/lib/__tests__/provider-routing.test.mjs` passes with new cases that fail before: (a) a verified row with `outcome: 'rejected'` and a non-empty `findings` but `informative: false` does NOT satisfy `requireInformativeTrial` (today it does, we:scripts/lib/provider-routing.mjs:256-262); (b) a verified row with `outcome: 'landed'` and `informative: true` DOES satisfy it (today it cannot); (c) `selectSupervisionLevel` returns `full` with the existing "no informative trial" reason when every row is `informative: false`.
3. **Executable** — on the branch, `grep -n "outcome !== 'rejected'" we:scripts/lib/provider-routing.mjs` prints nothing: the predicate reads the field and nothing else.
4. **Observable** — every existing `dispatchKind: "session-delegation"` row in we:scripts/conveyor/run-scorecards.json carries an explicit `informative` boolean. Backfill is `false` for every row except one a human names, because rule 4's meaning ("independent review found a real problem that was then fixed") cannot be recovered from the stored text, and guessing it is the inference the rule forbids.
5. **Observable** — `DEFAULT_BACKDOWN_THRESHOLDS` in we:scripts/lib/provider-routing.mjs is unchanged by this item's diff (`requireInformativeTrial` keeps its value; only what satisfies it moves).

> **Verified done, 2026-09-22.** Built and committed to `lane/mechanical-dispatcher` at `8d986d1c8`
> (tracker note `f9fed205f`). A later fix at `9a714989c` was needed for this rule to actually take
> effect through the real dispatch path (`we:scripts/lib/dispatch-contracts.mjs`'s `routingRecords()`
> was silently stripping the `informative` field before it reached `selectSupervisionLevel`). All named
> test files pass; zero `session-delegation` rows existed on the branch at build time, so no backfill
> was needed. Resolved here as `graduatedTo: none` — the code is not yet on `main`; it reaches `main`
> through #3443.
