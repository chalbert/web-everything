---
bornAs: x5wjc0a
kind: story
size: 2
status: open
scope: ["we:scripts/readiness/dispatch-plan.mjs", "we:scripts/readiness/__tests__/dispatch-plan*.test.mjs"]
dateOpened: "2026-10-02"
preparedDate: "2026-10-03"
preparedAgainstSha: "8d35ab340afcdf11f1e14ab490fdf7943f458f61"
tags: []
---


# dispatch-plan: restore the owner of the breach-attempt counter

Follow-up from the #3215 advisory (2026-10-02). Ordinary, non-fixture calls to we:scripts/readiness/dispatch-plan.mjs must again request attempt tracking from the scope collector when no planning snapshot is active. Snapshot planning and state observation remain pure reads.

## Design

In we:scripts/readiness/dispatch-plan.mjs, construct the scope-collector arguments as the collector path plus `--json`, appending `--no-track-attempts` only when `process.env[PLANNING_SNAPSHOT_ENV]` is truthy. Import the existing constant from we:scripts/lib/planning-snapshot.mjs alongside `planningRead`; use its existing truthiness semantics (unset and empty both mean no snapshot). Keep the fixture-mode bypass before the collector call.

The ordinary dispatch-plan collector invocation owns the tracking request; we:scripts/readiness/scope-lease-collect.mjs remains the sole implementation of counter persistence. Tracking means observing breach episodes, not incrementing on every tick: a new or changed breach set advances, a stable set does not, and clean observations or changed occupants reset according to the existing collector rules. Do not duplicate this logic in the planner or add a new writer.

Snapshot calls must retain the exact read-only collector arguments used by we:scripts/readiness/conveyor-state.mjs so we:scripts/lib/planning-snapshot.mjs can share the cached read. A snapshot-only builder round intentionally does not advance the counter; this change restores the card's proposed non-snapshot owner, not a guarantee of tracking during every builder round. Collector failures and invalid JSON continue through the existing fatal `runJson` path. Scope comparison and advisory escalation policy remain unchanged for source, documentation, configuration, and data files.

## MVP

1. Add a small argument-construction seam in we:scripts/readiness/dispatch-plan.mjs, taking an explicit environment for unit tests, and use it at the real collector invocation.
2. Extend we:scripts/readiness/__tests__/dispatch-plan.test.mjs with the unset, empty, and nonempty snapshot-environment cases.
3. Add we:scripts/readiness/__tests__/dispatch-plan-attempt-owner.test.mjs for the actual CLI argument boundary and collector tracking semantics. Use isolated child-process fixtures; never poll or mutate the real lane pool. No changes to collector persistence, snapshot storage, state-reader behavior, or builder scheduling are required.

## Test plan

- In we:scripts/readiness/__tests__/dispatch-plan.test.mjs, assert exact collector argument arrays: unset/empty snapshot env omits the opt-out; a nonempty snapshot directory includes it exactly once. Assert the input environment is not mutated.
- In the planned we:scripts/readiness/__tests__/dispatch-plan-attempt-owner.test.mjs, launch the real planner using a temporary queue file, explicit free lanes, disabled unrelated external checks, and a child-command stub that records collector argv and supplies bounded deterministic JSON. Do not use `--backlog-dir` for owner cases, since it bypasses collection. Cover unset, empty, and nonempty snapshot env. Separately prove fixture mode never invokes the collector.
- Drive the existing `collectSnapshot` and `advanceBreachCount` exports from we:scripts/readiness/scope-lease-collect.mjs using the captured tracking choice and an in-memory counter callback: first breach gives 1, unchanged breach remains 1, changed breach gives 2, clean observation resets, new occupant starts afresh. Snapshot mode must not invoke the callback. These are integration assertions about the chosen owner, not a replacement counter implementation.
- Exercise a nonzero collector exit and malformed collector JSON through the CLI stub; require a nonzero planner exit, not a successful empty-lease plan. Ensure fixture cleanup runs on failure.
- Reuse the existing regression suites in we:scripts/readiness/__tests__/scope-lease-collect.test.mjs and we:scripts/lib/__tests__/planning-snapshot.test.mjs to preserve episode semantics and snapshot eligibility/cache behavior.

## Proof plan

Run the affected Vitest suites: we:scripts/readiness/__tests__/dispatch-plan.test.mjs, the planned we:scripts/readiness/__tests__/dispatch-plan-attempt-owner.test.mjs, we:scripts/readiness/__tests__/scope-lease-collect.test.mjs, and we:scripts/lib/__tests__/planning-snapshot.test.mjs. Run `npm run check:standards` during implementation validation.

The decisive before/after proof is the real CLI argv capture: before the fix, an ordinary call includes `--no-track-attempts` and fails the new owner assertion; after the fix it omits the flag, while the snapshot case still includes it. Record the captured arrays and the counter-callback results. Use only isolated fixtures for this proof; do not claim that a production tick was exercised from unit results.

## Done when

1. The planned owner regression in we:scripts/readiness/__tests__/dispatch-plan-attempt-owner.test.mjs fails against the current unconditional opt-out and passes after the conditional wiring.
2. Non-snapshot dispatch planning requests tracking; snapshot planning and fixture mode cause no counter callback, and state observation retains its existing read-only behavior.
3. Collector errors still fail planning; scope handling for source, docs, config, and data is unchanged. The focused regressions and standards gate pass.

## Follow-ups

No prerequisite policy decision remains for the conditional repair originally proposed by this card. Continuous tracking in a deployment that runs only snapshot-backed builder rounds would require a separately scoped owner outside the pure planning round; this card does not introduce that writer. Literal per-build-retry counting also remains outside scope: the current collector explicitly documents its breach-episode approximation.

## Progress

- Preparation research at checkout `8d35ab340`: the old premise cited we:scripts/readiness/dispatch-plan.mjs:938 and described the loss of a per-tick counter owner. The unconditional opt-out is still present, now at we:scripts/readiness/dispatch-plan.mjs:957; the goal is not already delivered.
- Corrected premise: ordinary planner calls can regain tracking by conditionally omitting the flag, but snapshot-backed builder rounds remain pure. Evidence: we:scripts/lib/planning-snapshot.mjs:8 defines the environment key, and its `planningRead` only caches collector calls containing the opt-out. we:skills-src/conveyor/build-dispatch-daemon.mjs:715 creates a snapshot for each `cliPlanTick` call. Thus the repair must not be described as restoring tracking on every production builder tick.
- Counter ownership evidence: we:scripts/readiness/scope-lease-collect.mjs:605 computes and persists transitions, and :616 disables that callback when the opt-out is present. Its documented semantics at :35 describe breach episodes, not per-poll increments. we:scripts/readiness/conveyor-state.mjs:878 already opts out. we:scripts/readiness/dispatch-plan.mjs:957 also bypasses the collector entirely in fixture mode.
- Old scope: we:scripts/readiness/dispatch-plan.mjs and we:scripts/readiness/__tests__/dispatch-plan.test.mjs. Corrected scope retains the same production source and broadens only the matching test entry to we:scripts/readiness/__tests__/dispatch-plan*.test.mjs, covering the existing unit suite and the planned CLI owner regression. Collector, state reader, snapshot helper, and builder daemon are research dependencies, not implementation edits.
- This preparation changes only the card; implementation and before/after execution remain for delivery. No preparation stamp was added.
