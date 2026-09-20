---
bornAs: xjsj7pg
kind: story
size: 3
parent: "3718"
status: open
relatedTo: ["3612", "3438", "3720"]
scope: ["we:scripts/operations/review-dispatch.mjs", "we:scripts/conveyor/reconcile-fix-dispatch.mjs", "we:scripts/lib/lane-concurrency.mjs", "we:skills-src/conveyor/runner.mjs"]
dateOpened: "2026-09-19"
tags: []
---

# Put review and fix dispatch under the shared concurrency ceiling so re-armed PRs are dispatched staggered, not in a burst

The reconcile path dispatches one review per owed PR with no admission check. Re-arming many `review:pending` PRs at once therefore launches that many reviewers together; on 2026-09-19 the machine load reached 28 on 12 cores.

## What exists and what does not

- The ceiling exists: `we:scripts/lib/lane-concurrency.mjs` (#3612), one resolver and one trim function shared by `we:scripts/readiness/dispatch-plan.mjs` (builds) and `we:scripts/conveyor/tick-core.mjs` (prepare, fix, ci-heal). Its own header says it is a fixed count and hardware-blind by design.
- The reconcile dispatch path does not use it. In `we:skills-src/conveyor/runner.mjs` (`makeCliMechanicalPasses`) the review-reconcile pass loops over every `review` entry in the reconcile plan and calls `we:scripts/operations/review-dispatch.mjs` for each, sequentially but with no count of live sessions. `we:scripts/conveyor/reconcile-fix-dispatch.mjs` has the same shape. A search of those two files and `we:scripts/conveyor/reconcile-pass.mjs` finds no admission or ceiling reference.
- #3612 (open) is the older, broader "cap concurrent dispatched lanes" story; the resolver above is what landed from it. Before starting, check whether #3612 is now redundant with this slice and, if so, say so on both cards rather than filing a third.

## Fix shape

- `review-dispatch` and `reconcile-fix-dispatch` each read the live dispatched-session count and the ceiling from the shared resolver, dispatch at most the remaining headroom, and REPORT the overflow as `deferred: over-ceiling` (never dropped, never an error). The next call picks the overflow up, because reconcile re-derives what is owed every time. That is the stagger.
- A caller-supplied budget wins when smaller: `land-advance` (#3720) computes one budget up front and passes it down.
- Do not add a load-average gate here; that lives in `land-advance` (#3720) as its one new rule. If the operator wants load-awareness for every caller, it belongs inside `we:scripts/lib/lane-concurrency.mjs` and is a separate call, not folded in silently.

## Done when

1. **Executable** — `npx vitest run we:scripts/operations/__tests__/review-dispatch.test.mjs we:scripts/conveyor/__tests__/reconcile-fix-dispatch.test.mjs` carry cases that fail before and pass after: with the ceiling at 3 and 2 live sessions, ten owed reviews dispatch exactly one and report nine deferred; at the ceiling, none dispatch and none error; a smaller caller budget is honoured.
2. **Probed live** — re-arming several real `review:pending` PRs dispatches no more reviewers in one pass than the ceiling allows.
