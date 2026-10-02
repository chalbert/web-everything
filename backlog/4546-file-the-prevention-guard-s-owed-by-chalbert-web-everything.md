---
bornAs: x58u2h9
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/driver-watchdog.mjs", "we:scripts/conveyor/tick-core.mjs", "we:scripts/conveyor/__tests__/driver-watchdog.test.mjs", "we:scripts/conveyor/__tests__/tick-core.test.mjs"]
dateOpened: "2026-09-29"
preparedDate: "2026-10-02"
preparedAgainstSha: "d9c89663210907136169df01d7ce96209ff29abb"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2998's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval"). Preserve the two prevention obligations from the advisory review: exhaustive launch-kind coverage in the watchdog, and named tests proving the inline behavioral guarantees around prepare-item attempt bookkeeping.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2998@71f593e41895963f579481656b26f3a325b5a159

## Progress

Preparation research against checkout `d9c89663210907136169df01d7ce96209ff29abb`:

- **Original premise/scope:** add a launch-kind-derived test at we:scripts/conveyor/driver-watchdog.mjs:103, replacing a hardcoded list cited with an incomplete test path; consider a general table-derivation standards rule. The second obligation requested a strict review lens or standard for inline guarantees, citing we:scripts/conveyor/tick-core.mjs:1285. Scope contained the two runtime modules and their two test suites.
- **Corrected premise/scope:** retain that four-file implementation/test scope. The first gap is an actual missing watched prefix, not only missing future-proof coverage. The complete test path is we:scripts/conveyor/__tests__/driver-watchdog.test.mjs:1150; its six-kind list omits `prepare-item`. The seven-kind `LAUNCH_KINDS` in we:scripts/operations/dispatch-lane.mjs:299 includes it; `sessionSlugFor` in we:scripts/operations/dispatch-lane.mjs:487 emits `prepare-item-3383`. A read-only Node probe importing those exports and `sessionMatchesItem` returned false for that slug and true for the other six. The source list remains at we:scripts/conveyor/driver-watchdog.mjs:103.
- **Second obligation grounded:** the historical citation referred to the attempt-tally comment; its current location is we:scripts/conveyor/tick-core.mjs:1285–1295. It promises a count for a claimed TTL retirement and removal when the item leaves all holds. Existing tests at we:scripts/conveyor/__tests__/tick-core.test.mjs:932 and :954 cover rotation and unclaimed retirement, but there is no direct seeded-counter test for retention across a hold-reason change or removal on leaving the held set. The separate reason-flip tests at we:scripts/conveyor/__tests__/tick-core.test.mjs:878 and :906 exercise guard retention, not the attempt-counter lifecycle.
- **Existing policy, not a new fork:** we:docs/agent/delivery-loop.md, “Writing the mandate,” already requires every prose guarantee to have a named test that reddens when the guarded behavior is broken. Apply that established review lens to this card's concrete guarantees. A new universal comment parser or mandatory derivation of every launch-kind table is unnecessary to discharge this debt and would conflict with the watchdog's deliberate runtime independence if applied indiscriminately.

## Design

Keep the watchdog independent of dispatch decision logic. In we:scripts/conveyor/__tests__/driver-watchdog.test.mjs, import `LAUNCH_KINDS` alongside the existing `sessionSlugFor` import and enumerate the canonical launch kinds in the agreement test. Generate each slug with an identical item and PR identifier so PR-keyed kinds exercise prefix recognition, without claiming PR identity equals item identity in production. Assert recognition through `sessionMatchesItem`, which reads `WATCHED_SESSION_KINDS`; do not assert list equality because the watched list intentionally also contains `review`.

Add `prepare-item` to `WATCHED_SESSION_KINDS` in we:scripts/conveyor/driver-watchdog.mjs and update the adjacent coverage comment. The runtime must not import the dispatcher. Keep the existing import-graph purity test intact. Episode-keyed health investigations are explicitly outside `LAUNCH_KINDS` and are not queued-item sessions; do not broaden this change to them.

In we:scripts/conveyor/__tests__/tick-core.test.mjs, add directly named `planTick` tests for the attempt-tally guarantees at we:scripts/conveyor/tick-core.mjs:1285–1295. Cover a seeded count surviving an arbitrary held reason, disappearing when its item leaves the held set, and increasing exactly once for a claimed TTL retirement. Retain the existing unclaimed-TTL test. Feed `nextState` into the next tick to prove a retired guard is not charged twice. Use no available lanes when isolating counter bookkeeping, so new dispatches cannot confound the assertions.

Describe cleanup precisely as “no longer present in any hold.” A transition from `needs-prepare` to `blocked` does not clear the tally. Correct the comment's parenthetical examples if they imply that preparation or reshaping alone clears a count while another hold remains. No new policy or global standards rule is required.

## MVP

1. Replace the six-kind test list with canonical enumeration and demonstrate the existing `prepare-item` failure.
2. Add the missing watched prefix and a named regression showing a queued item with a live `prepare-item` session is `working` and not actionable, even with no runner lease, using the existing watchdog fixture.
3. Add the focused attempt-counter lifecycle tests and align the inline guarantee with the actual held-set predicate. Change runtime bookkeeping only if these tests expose a violation of the stated invariant.
4. Supply a guarantee-to-test mapping in the implementation review, with mutation results for coverage, retention, cleanup, and counting. Use the existing review mandate from we:docs/agent/delivery-loop.md.

## Test plan

- **Watchdog source/test pair:** we:scripts/conveyor/driver-watchdog.mjs → we:scripts/conveyor/__tests__/driver-watchdog.test.mjs. Enumerate every `LAUNCH_KINDS` member through `sessionSlugFor`; assert the new live-session classification; preserve alias-rejection and forbidden-import-graph checks.
- **Tick source/test pair:** we:scripts/conveyor/tick-core.mjs → we:scripts/conveyor/__tests__/tick-core.test.mjs. Seed multiple counts, keep one item held as `blocked`, remove another from all holds, and assert the exact resulting tally. Separately assert claimed TTL increment once across two ticks and preserve the unclaimed-TTL zero-cost case.
- Run the targeted Vitest suites by their two paths above using `npx vitest run`, followed by `npm run check:standards` at implementation time. Tests must use injected facts and temporary fixtures; no live driver, rollback, agent dispatch, or production sidecar writes.

## Proof plan

Before the runtime fix, run the newly canonicalized watchdog test: it must fail with `prepare-item ⇒ prepare-item-3383 is not watched`. After adding the prefix, rerun the same test and both targeted suites and record exit status and named results.

Mutation proof is part of acceptance: temporarily remove the `prepare-item` prefix and confirm the canonical coverage and live-session tests fail; narrow counter retention to `needs-prepare` and confirm the blocked-retention test fails; keep counters unconditionally and confirm the cleanup test fails; remove the claimed-TTL increment and confirm its named test fails; drop the `claimed` condition and confirm the existing unclaimed-TTL test fails. Restore each mutation before proceeding and rerun the targeted suites on clean implementation bytes. These probes prove the specific comment guarantees under the existing review rule, rather than assuming test presence proves coverage.

## Done when

Canonical launch-kind enumeration fails on the pre-fix watchdog and passes with the missing prefix restored; every listed attempt-counter guarantee has a directly asserting named test and recorded failing mutation. The watchdog import-graph boundary and both targeted suites remain green, and `npm run check:standards` passes. No dispatcher runtime dependency is added to the watchdog.

## Follow-ups

The advisory suggestion of a repository-wide rule for launch-kind-keyed tables remains optional and outside this MVP. Any later proposal must distinguish deliberate independent observers from tables that should derive from the dispatcher, and must have its own bounded examples and tests. Do not add a global inline-comment parser: the existing mutation-based review mandate already supplies the requested strict lens. No additional card is created during preparation.
