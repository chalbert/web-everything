---
kind: story
size: 8
parent: "xdmqryh"
status: open
blockedBy: ["xuznx3v"]
scope: ["we:scripts/operations/health-responder-ci.mjs", "we:scripts/operations/__tests__/health-responder-ci.test.mjs", "we:scripts/conveyor/health-responder.mjs", "we:scripts/operations/ci-heal-pr-dispatch.mjs", "we:scripts/operations/__tests__/ci-heal-pr-dispatch.test.mjs", "we:scripts/conveyor/ci-red-recovery-watch.mjs", "we:scripts/conveyor/__tests__/ci-red-recovery-watch.test.mjs", "we:scripts/conveyor/__tests__/fixtures/health-responder/ci-routing.json", "we:scripts/conveyor/__tests__/ci-heal-mark.test.mjs"]
dateOpened: "2026-10-02"
preparedDate: "2026-10-02"
tags: [conveyor, health]
---

# Health responder: route bounded CI recovery through existing owners

Implement the disabled CI adapter from epic #xdmqryh. Let the existing reconcile plan choose own-failure heal, recovered-main refresh, hung-run or missing-run recovery; preserve claims, capability/admission gates, durable caps and terminal holds. Add target/head guards to existing actuators instead of a new healer. Replay #3373 two missing-run attempts and #3415 three-heal exhaustion. Grounding: we:scripts/conveyor/reconcile-core.mjs:1838; we:scripts/operations/ci-heal-pr-dispatch.mjs:100; we:scripts/conveyor/ci-red-recovery-watch.mjs:809.


## Implementation contract

Slice 3 of epic #xdmqryh. Apply its full action catalogue, safety, escalation and measurement contract in we:backlog/xdmqryh-health-responder-a-daemon-that-acts-on-health-signals-not-on.md. The current-source references below establish existing behavior; proposed files/limits describe work still owed.

Add a disabled CI adapter that selects only the current owning planner's route for an episode-nominated PR. No independent failure classifier, healer, git writer, or retry counter.

- Run the existing reconcile read/plan for the explicit repo/PR/current head. Preserve stood-down, live-worker/fix claim, dispatch pause, capability, queue admission and all durable attempt refusals. Sources: we:scripts/conveyor/reconcile-core.mjs:1469, we:scripts/conveyor/reconcile-core.mjs:1838; we:scripts/operations/ci-heal-pr-dispatch.mjs:100, we:scripts/operations/ci-heal-pr-dispatch.mjs:245.
- Route `ci-heal` to targeted `runReconcileCiHealDispatch`; recovered-main, hung-run and missing-run entries to the respective existing sweeps at we:scripts/conveyor/ci-red-recovery-watch.mjs:202, we:scripts/conveyor/ci-red-recovery-watch.mjs:622 and we:scripts/conveyor/ci-red-recovery-watch.mjs:809. Add target and expected-head filtering in those owners. Re-read/replan inside shared action claims so ordinary daemon and responder do not double-spend a recovery attempt. Long work remains an existing detached job, not a blocking tick.
- Do not translate `missing-run-cap-exhausted`, `owed-elsewhere` or uncertain/unrelated failure into permission for a heal. A known recovered-main route may refresh through the existing fast-forward-only helper (we:scripts/lib/rebase-drop-manifest.mjs:227). Generic failed-run reruns do not repair an old broken-main base. Unknown failure attribution escalates when high; a comment alleging flakiness is not classification proof.
- Preserve the CI marker counter, owed-write flush and accepted-only handback. `ci-heal-mark` is run by the actual repair owner after work, never by the responder to make a PR look attended (we:scripts/conveyor/ci-heal-mark.mjs:38, we:scripts/conveyor/ci-heal-mark.mjs:104, we:scripts/conveyor/ci-heal-mark.mjs:208).
- Reserve the epic's A1/P caps; at most two responder CI attempts per PR per day and the existing durable floor, whichever refuses sooner. Record failures/timeouts after submission as spent. A job spawned is attended, not recovered; verify the required check/new real run in a later observation. Preserve the head and existing caps after restart.

## Scope boundary

9 scope paths, two areas: we:scripts/operations/ and we:scripts/conveyor/. Frontmatter is the explicit predicted touch set; do not widen it silently. Backlog delivery metadata is administrative, not another implementation area. Read-only references outside scope are not permission to edit those files. No shared agent-document edits. Changes to existing shared actuators stay in their existing owner, with their existing tests.

This is independently deliverable after slice 1: the adapter and its detector extension land disabled, with injectable contract tests; actual live enablement belongs to slice 6. The shared responder-shell path intentionally makes overlapping sibling wiring serialize in the lane planner.

## Test plan and replay

C1 (#3373) with two durable missing-run attempts -> no third trigger; C2 (#3415) with three heal markers -> no fourth heal. Add explicitly synthetic recovered-main-green, main-still-red, own-failure, hung-run and missing-run snapshots to test the real route classification; allegation of flakiness without corroboration -> hold. Inject new head, live worker/fix claim, pause, exhausted/unknown budget, unavailable repo profile and ambiguous GitHub response. Ordinary daemon/responder concurrency must share the claim and produce one attempt. A launched job without a real new check is not counted unstuck.

Primary executable checks (new test entrypoints are expected to be absent before this story):

```bash
responder_test_1='we:scripts/operations/__tests__/health-responder-ci.test.mjs'
responder_test_2='we:scripts/operations/__tests__/ci-heal-pr-dispatch.test.mjs'
responder_test_3='we:scripts/conveyor/__tests__/ci-red-recovery-watch.test.mjs'
npx vitest run "${responder_test_1#we:}" "${responder_test_2#we:}" "${responder_test_3#we:}"
npm run check:standards
lane_verifier='we:scripts/verify-lane.mjs'
node "${lane_verifier#we:}"
```

Use isolated temporary roots, mocked GitHub/actuator IO and injected clocks. Assertions must inspect the called existing owner, expected identity, durable receipt and preserved forbidden state; a snapshot of proposed prose alone is not evidence. No live host files or production PRs are mutated by replay.

## Done when

1. **Executable:** the primary checks above pass, including the named replay and negative/race cases. The implementation leaves the epic’s traceable receipt and uses the existing actuator boundaries.
2. **Must refuse on error:** missing/partial/stale facts, unknown authority/owner, changed head/lease, exhausted caps, terminal holds and kill/pause settings cannot reach a forbidden write. An ambiguous write is never automatically repeated.
3. **Must cover every input kind:** documentation, config, data, backlog and source inputs all retain the same review/ownership gates; no non-code exemption, synthetic approval or clearing of `review:human`.
4. **Observable:** the adapter is still disabled by default; a fixture replay proves its postcondition/refusal through the existing owner, and its future canary requirement is recorded in the epic.

## Follow-ups

Record replay limitations, observed product gaps and testing lessons here. Do not append to shared agent docs or silently add a new automatic action beyond the epic’s catalogue.
