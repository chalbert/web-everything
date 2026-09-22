---
bornAs: xm3i597
kind: story
size: 3
parent: "3717"
status: resolved
scope: ["we:scripts/lib/provider-routing.mjs", "we:scripts/lib/__tests__/provider-routing.test.mjs", "we:scripts/lib/dispatch-contracts.mjs", "we:scripts/lib/__tests__/dispatch-contracts-route.test.mjs", "we:scripts/lib/dispatch-task-type.mjs", "we:scripts/lib/__tests__/dispatch-task-type.test.mjs", "we:scripts/gen-dispatch-routing-table.mjs", "we:docs/agent/dispatcher-runbook.md"]
dateOpened: "2026-09-21"
dateStarted: "2026-09-22"
dateResolved: "2026-09-22"
graduatedTo: none
tags: []
---

# Fork 3 of #3801, core: the routing and trust record gains a subject axis (work task type, role kind, review lens); the authoring roles stay on Claude and record their tier

Ruled in #3801 Fork 3 (c): trust is per {provider, model, subject} and never carries across subjects. The subject is the taskType for work, the role kind for a role, and the lens for a review seat, and work and reviewer evidence stay in separate subject classes. No graduated candidate resolves to Claude. Interim for prepare, prepare-decision and investigate: they keep their Claude spawn and routed: null, but record the tier STORY_KIND_RUNGS names (we:scripts/lib/dispatch-contracts.mjs:89) instead of tier: null. The work routes do not change.

**Home:** the prototype branch `lane/mechanical-dispatcher`. `we:scripts/lib/provider-routing.mjs` also exists on `main`; the change is made to the branch copy, which the router reads there. Commit straight to the branch, no PR, one tracker note on #3383 per push; it reaches `main` through #3443.

**What exists (checked on `5ab89f87b`).** Scorecard rows already carry a `subjectClass` field (`work-agent` on every row of the branch's `we:scripts/conveyor/run-scorecards.json`), and `selectSupervisionLevel` keys trust on `{provider, model, taskType}`. A role dispatch is recorded with `tier: null` (`we:scripts/lib/dispatch-contracts.mjs`, the role branch of `decideDispatchRoute`).

**Governed change, stated.** Rule 1 of `we:docs/agent/platform-decisions.md#delegation-trial-record-graduation` makes any change to what the record counts a governed change wherever it is read. This slice adds the subject axis only: a work subject is its `taskType`, so every existing work route and the checked-in routing table stay the same. It changes no threshold.

**Not in this slice:** the subject key and positive control for `prepare`, `prepare-decision` and `investigate` (#3801 follow-up 4, not yet prepared); until then they keep `routed: null`. The review seat's routing is the sibling slice that is `blockedBy` this one.

## Done when

1. **Executable** — `npx vitest run we:scripts/lib/__tests__/provider-routing.test.mjs we:scripts/lib/__tests__/dispatch-contracts-route.test.mjs we:scripts/lib/__tests__/dispatch-task-type.test.mjs` passes with new cases that fail before: (a) a reviewer-subject scorecard row with the same provider and model never counts toward a work triple, and a work row never counts toward a review-lens subject; (b) a `prepare` dispatch records the tier `STORY_KIND_RUNGS.prepare` names and a `prepare-decision` or `investigate` dispatch the Opus tier, with `routed: null`; (c) a review-lens subject with no graduated candidate resolves to Claude at `full`.
2. **Executable** — the routing-table drift test named in #3717 still passes unchanged: `node we:scripts/gen-dispatch-routing-table.mjs` output equals the table in `we:docs/agent/dispatcher-runbook.md` (the work routes did not move).

> **Verified done, 2026-09-22.** Already built and committed straight to `lane/mechanical-dispatcher` at
> `d6c1bab3a` ("#3845 fork 3 of #3801: trust keyed {provider, model, subjectClass, taskType}; role dispatches
> record their STORY_KIND_RUNGS tier"), ahead of this card being picked up. Re-verified: all three named test
> files pass (`we:scripts/lib/__tests__/provider-routing.test.mjs`,
> `we:scripts/lib/__tests__/dispatch-contracts-route.test.mjs`,
> `we:scripts/lib/__tests__/dispatch-task-type.test.mjs`) with the subject-axis cases present, and
> `node we:scripts/gen-dispatch-routing-table.mjs` reports the runbook table unchanged. Resolved here as
> `graduatedTo: none` — the code is not yet on `main`; it reaches `main` through #3443, per this card's own
> `Home:` section.
