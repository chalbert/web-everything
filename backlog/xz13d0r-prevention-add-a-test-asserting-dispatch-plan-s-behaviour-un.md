---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/readiness/dispatch-plan.mjs", "we:scripts/lib/pr-limit.mjs", "we:skills-src/conveyor/build-dispatch-daemon.mjs", "we:scripts/conveyor/soak/breaks/large-queue-slow-already-done.mjs", "we:scripts/readiness/already-done-refresh.mjs", "we:scripts/lib/child-failure.mjs", "we:scripts/readiness/__tests__/dispatch-plan.test.mjs", "we:scripts/lib/__tests__/pr-limit.test.mjs", "we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs", "we:scripts/conveyor/soak/breaks/__tests__/large-queue-slow-already-done.test.mjs", "we:scripts/readiness/__tests__/already-done-refresh.test.mjs", "we:scripts/lib/__tests__/child-failure.test.mjs"]
dateOpened: "2026-09-30"
tags: []
---

# Prevention — Add a test asserting dispatch-plan's behaviour under a deferred-low-budget admission, stating explicitl… (from chalbert/web-everything#3215 review)

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/readiness/dispatch-plan.mjs:752` — Add a test asserting dispatch-plan's behaviour under a deferred-low-budget admission, stating explicitly whether it skips or proceeds. Also flag exports that lose their last caller.
2. `we:scripts/lib/pr-limit.mjs:131` — Log or emit a `prLimit: {source: 'cache-miss'}` field in the plan output and add a soak asserting the hold still engages with a warm snapshot. Consider a lightweight gate requiring new fail-open paths to be surfaced in tick output.
3. `we:skills-src/conveyor/build-dispatch-daemon.mjs:223` — Guard with `if (error && typeof error === 'object')`, and add a test rejecting with a primitive.
4. `we:scripts/conveyor/soak/breaks/large-queue-slow-already-done.mjs:46` — Prefer relative bounds (new vs pre-fix ratio) or much looser ceilings, and keep the count assertions as the hard gate. A review lens for wall-clock assertions in soak tests would catch this class.
5. `we:scripts/lib/pr-limit.mjs:131` — Add a planner test asserting prLimitHeld behaviour when the snapshot is cold and local refs are missing. Consider a distinct 'unknown-local' state that keeps the last known hold instead of fail-open.
6. `we:scripts/readiness/dispatch-plan.mjs:787` — Add a test or grep-based check that some non-planner path still advances the breach counter. Document the counter's single writer.
7. `we:scripts/readiness/already-done-refresh.mjs:66` — Also expire the lock by age regardless of pid liveness (for example older than guardian timeout + slack), or store and compare the process start time. Add a test with a live-but-foreign pid and an old lock.
8. `we:scripts/lib/child-failure.mjs:2` — Route childFailure output through a shared redact-and-truncate helper (URL userinfo, gh tokens, a length cap). Add a test that a token-bearing URL in stderr is masked.
9. `we:scripts/readiness/already-done-refresh.mjs:50` — Add a deterministic regression test with a merged item missing from complete local history and require eventual background selection without a foreground fetch.
10. `we:scripts/readiness/dispatch-plan.mjs:938` — Restore a deterministic CLI test asserting bypass neither reads nor writes verdicts, using default cooldowns, a prepopulated cache, and an assertion after the worker exits.
11. `we:scripts/lib/pr-limit.mjs:156` — A unit test for `countOpenPrsForRepo` with `localOnly: true` using a real git repository fixture that has not fetched the PR branch, asserting that it degrades gracefully (e.g., returns `unavailable: true`) rather than returning a false `count: 0`.
12. `we:scripts/readiness/already-done-refresh.mjs:37` — Add a case-sensitivity check with mixed-case aliases in `we:already-done-refresh.test.mjs`.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3215@6d1033cc0d6e235a2df2bf17411b1e0273fa9957

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
