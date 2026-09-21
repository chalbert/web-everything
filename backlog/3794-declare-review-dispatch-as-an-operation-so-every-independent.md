---
bornAs: x8wzvm7
kind: story
size: 3
parent: "3383"
status: open
relatedTo: ["3752", "3727", "3730", "3279"]
scope: ["we:scripts/operations/review-dispatch.mjs", "we:scripts/operations/review-dispatch-wrapper.mjs", "we:scripts/operations/dispatch-lane-io.mjs", "we:scripts/operations/run.mjs"]
dateOpened: "2026-09-21"
tags: []
---

# Declare review-dispatch as an operation so every independent review runs through operations only

The orchestrator runs `node we:scripts/operations/review-dispatch.mjs` (a plain script) for every independent review, contrary to the operations-only rule. Declare it as an operation so a review dispatch leaves a run record, appears in `runner-activity`, and is refused by the same guards as any other declared dispatch. Design-first and deliberately not cleared for the conveyor.

## FOUND (2026-09-21)

- **It is a plain module, on purpose.** The header of we:scripts/operations/review-dispatch.mjs (`#3279`) explains why it is not a declared operation: no tick-loop bookkeeping to feed, no double-dispatch guard to read, no run record for a health scan. That reasoning predates the rule that every dispatch goes through a declared operation. `grep -c review-dispatch` on we:scripts/operations/run.mjs returns 0 on both main and `origin/lane/mechanical-dispatcher`.
- **Two implementations of it exist.** On main the script spawns a `claude --bg` reviewer through `defaultSpawnAgent` (we:scripts/operations/dispatch-lane-io.mjs). On the prototype branch the default path is `dispatchReviewMechanical` in we:scripts/operations/review-dispatch-wrapper.mjs (lane-pool acquire, then the review loop, then release, with no live agent), and `--agent` keeps the spawned reviewer reachable.
- **The human-review operation is a different thing.** `review-pr` (we:scripts/operations/review-pr.mjs) is the review operation; its `confirm` step suspends the engine as the human stop, so it cannot be the unattended dispatch.
- **Nearby cards.** #3752 (open) has we:scripts/operations/review-dispatch.mjs in its scope for the hand-dispatch prompt and idle subscription; #3727 (open) puts review dispatch under the shared concurrency ceiling. Neither declares the operation.

## DESIGN TO SETTLE

1. **Shape.** `read` (the PR, the repo, whether a review is already in flight), `plan` (pure: dispatch or refuse and why), `effect` (the spawn), like `dispatch-task`. Which of the two implementations does the effect call, and does `--agent` survive as an input?
2. **Reuse, not a second spawn.** The effect must call `defaultSpawnAgent` / `buildAgentArgv` from we:scripts/operations/dispatch-lane-io.mjs, per the statute that forbids a second spawn implementation.
3. **Run record and guard.** Write a run record through the run store, and refuse a second dispatch for the same PR while one is in flight (the run-record guard).
4. **Completion signal.** For the spawned path, the idle-subscription output the orchestrator needs (#3752); for the mechanical path, the review verdict and result pointer.
5. **Where it lands.** Main or the prototype branch first (the two files differ).

## Done when

1. **Executable** — `node we:scripts/operations/run.mjs review-dispatch --pr=<N> --repo=chalbert/web-everything --json` (dry run by default) resolves the operation and prints its plan; today it fails with an unknown operation (`review-dispatch` is not in `we:scripts/operations/run.mjs`). A test in the operations suite asserts the three steps (read, plan, effect), that the effect reuses `defaultSpawnAgent` rather than a second spawn, and that a second dispatch for the same PR while one is in flight is refused by the run-record guard.
2. **Probed live** — one real review dispatched through the operation appears in `node we:scripts/operations/run.mjs runner-activity` as an in-flight dispatch.
