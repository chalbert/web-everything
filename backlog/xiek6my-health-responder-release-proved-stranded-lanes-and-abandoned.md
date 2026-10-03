---
kind: story
size: 8
parent: "xdmqryh"
status: open
blockedBy: ["xuznx3v"]
scope: ["we:scripts/operations/health-responder-lanes.mjs", "we:scripts/operations/__tests__/health-responder-lanes.test.mjs", "we:scripts/conveyor/health-responder.mjs", "we:scripts/conveyor/__tests__/health-responder.test.mjs", "we:scripts/conveyor/health-smells/stranded-lane.mjs", "we:scripts/conveyor/health-smells/__tests__/stranded-lane.test.mjs", "we:scripts/conveyor/health-watch.mjs", "we:scripts/conveyor/__tests__/health-watch.test.mjs", "we:scripts/conveyor/lease-reaper.mjs", "we:scripts/conveyor/__tests__/lease-reaper.test.mjs", "we:scripts/lane-pool.mjs", "we:scripts/__tests__/lane-pool-release-reap-race.test.mjs", "we:scripts/conveyor/orphan-claim-release.mjs", "we:scripts/conveyor/__tests__/orphan-claim-release.test.mjs", "we:scripts/conveyor/__tests__/fixtures/health-responder/lane-claims.json"]
dateOpened: "2026-10-02"
preparedDate: "2026-10-02"
tags: [conveyor, health]
---

# Health responder: release proved stranded lanes and abandoned claims

Implement the disabled lane/claim adapter from epic #xdmqryh and the watch-only stranded-lane descriptor. Reuse targeted lease-reaper to lane-pool release and orphan-claim-release through a normal leased delivery lane. Require positive dead/terminal owner, unchanged lease, clean tree, proved main/open-PR coverage (or no own commits), and full claim signals; never use TTL alone or resolve a delivered card from a mention. Replay LANE1 using the observed #3311 merge with an explicitly synthetic lease, and CLAIM1. Grounding: we:scripts/conveyor/lease-reaper.mjs:677; we:scripts/lane-pool.mjs:2551; we:scripts/conveyor/orphan-claim-release.mjs:184.


## Implementation contract

Slice 4 of epic #xdmqryh. Apply its full action catalogue, safety, escalation and measurement contract in we:backlog/xdmqryh-health-responder-a-daemon-that-acts-on-health-signals-not-on.md. The current-source references below establish existing behavior; proposed files/limits describe work still owed.

Add disabled, targeted lane/claim actions; the watch continues to own all detection. Neither an old heartbeat nor missing process data proves safe reclamation.

- Add the epic's `stranded-lane` descriptor to the watch registry: terminal owned run/PR, positively dead worker and unchanged lease, two observations; measure tree cleanliness, local-only commits, remote reachability, verify head and main/open-PR coverage separately. Reuse existing reaper/stale-state facts; no second owner parser. Wire the epic’s explicit candidate measure in the watch shell; descriptor defaults are host/every-tick, medium with one-hour escalation, alert, two breach/two clean samples and missing-subjects-unknown. Partial reads hold the episode; explicit complete clean results close it (we:scripts/conveyor/health-watch-core.mjs:399). Registry discovery: we:scripts/conveyor/health-smells/index.mjs:30. Existing predicate inputs: we:scripts/conveyor/lease-reaper.mjs:677 and we:scripts/conveyor/lease-reaper.mjs:938.
- Both `stranded-lane` and `lane-starvation` nominate individual leases, not permission to release. Detection includes committed unpushed work and pushed branches with no PR. Release requires no uncommitted changes and either no own commits or proof all work is already on main or remotely reachable in a matching open PR. Anything else belongs to #xhrmvts: hold/report until its separately gated finish action is available, never release as a fallback. Apply the stricter responder conditions before reusing the existing targeted reaper -> lane-pool release. Share the receipt across both smells for the same lease generation. Existing reaper deliberately calls release with `--force` (we:scripts/conveyor/lease-reaper.mjs:1337); that controlled dead-owner release is not a git force-push and is never caller-selectable. No unreserve, trim, reclaim, provision, reset or arbitrary cleanup is exposed.
- Extend the existing target boundary with expected holder/generation so a new lease appearing before the release CLI starts is protected as well as the CLI's existing in-process compare-and-remove race. Sources: we:scripts/lane-pool.mjs:2480, we:scripts/lane-pool.mjs:2551. Dirty/unpushed/uncovered-commits/unknown or reserved lanes stay untouched by release even when another reaper axis would permit them. The ordinary reaper remains owner of its own broader policy; do not loosen it for this adapter.
- For `stale-claim`, accept only an `abandoned:` subject and revalidate the existing orphan-release predicate. Reject preparing/epic/open-PR/live-session/merged-delivery and incomplete coverage. Existing owner chooses release versus settle at we:scripts/conveyor/orphan-claim-release.mjs:184. Add target filtering to its existing lane -> edits -> verify -> parked PR path (we:scripts/conveyor/orphan-claim-release.mjs:362). Never splice main or directly resolve a `landed:` card.
- Do not call fix-end on a foreign claim or forge a worker identity: the current release boundary is owner/token checked (we:scripts/conveyor/fix-procedure.mjs:240). Lane-worker-without-lease means a LIVE worker needing protection, not stranded work (we:scripts/conveyor/health-smells/lane-worker-without-lease.mjs:20).
- Caps: one attempt per lease generation, four releases/hour; one per claim generation/day, two claim actions/hour; common fleet cap twelve/hour. No action when host ownership reads or auth are unknown. Journal the episode in the existing release reason and responder receipt; verified release preserves the tree and targets exactly one lease.

## Scope boundary

14 scope paths, three areas: we:scripts/operations/, we:scripts/conveyor/, the lane-pool writer and its tests in we:scripts/. Frontmatter is the explicit predicted touch set; do not widen it silently. Backlog delivery metadata is administrative, not another implementation area. Read-only references outside scope are not permission to edit those files. No shared agent-document edits. Changes to existing shared actuators stay in their existing owner, with their existing tests.

This is independently deliverable after slice 1: the adapter and its detector extension land disabled, with injectable contract tests; actual live enablement belongs to slice 6. The shared responder-shell path intentionally makes overlapping sibling wiring serialize in the lane planner.

## Test plan and replay

LANE1 uses #3311’s observed Oct 1 merge event 32290837604 and an explicitly synthetic terminal/dead clean reachable lease; there is no claimed historical lane number in the digest. CLAIM1 is explicitly synthetic abandoned/landed/preparing/partial-coverage state. Add existing live lane-worker-without-lease shapes as negative controls. Replace the lease between plan, actuator entry and marker removal; the new holder must survive. Include clean pushed/no-PR and local-only green commits in both the descriptor tests and we:scripts/conveyor/__tests__/fixtures/health-responder/lane-claims.json: both emit candidates but get zero release until #xhrmvts confirms publication and matching PR coverage. If finishing is disabled/unavailable, keep the lane and report it. Main-covered, exact-head open-PR-covered and no-own-commit lanes are positive controls. Reserved/live/unknown/dirty/unpushed lanes get zero release/cleanup; a bare TTL expiry is insufficient. Do not test against actual host lanes.

Primary executable checks (new test entrypoints are expected to be absent before this story):

```bash
responder_test_1='we:scripts/operations/__tests__/health-responder-lanes.test.mjs'
responder_test_2='we:scripts/conveyor/health-smells/__tests__/stranded-lane.test.mjs'
responder_test_3='we:scripts/conveyor/__tests__/lease-reaper.test.mjs'
responder_test_4='we:scripts/__tests__/lane-pool-release-reap-race.test.mjs'
responder_test_5='we:scripts/conveyor/__tests__/orphan-claim-release.test.mjs'
npx vitest run "${responder_test_1#we:}" "${responder_test_2#we:}" "${responder_test_3#we:}" "${responder_test_4#we:}" "${responder_test_5#we:}"
npm run check:standards
lane_verifier='we:scripts/verify-lane.mjs'
node "${lane_verifier#we:}"
```

Use isolated temporary roots, mocked GitHub/actuator IO and injected clocks. Assertions must inspect the called existing owner, expected identity, durable receipt and preserved forbidden state; a snapshot of proposed prose alone is not evidence. No live host files or production PRs are mutated by replay.

## Done when

1. **Executable:** the primary checks above pass, including the named replay and negative/race cases. The implementation leaves the epic’s traceable receipt and uses the existing actuator boundaries.
2. **Must refuse on error:** uncommitted changes, commits without proved main/open-PR coverage, missing/partial/stale facts, unknown authority/owner, changed head/lease, exhausted caps, terminal holds and kill/pause settings cannot reach a forbidden write. An ambiguous write is never automatically repeated.
3. **Must cover every input kind:** documentation, config, data, backlog and source inputs all retain the same review/ownership gates; no non-code exemption, synthetic approval or clearing of `review:human`.
4. **Observable:** the adapter is still disabled by default; a fixture replay proves its postcondition/refusal through the existing owner, and its future canary requirement is recorded in the epic.

## Follow-ups

Record replay limitations, observed product gaps and testing lessons here. Do not append to shared agent docs or silently add a new automatic action beyond the epic’s catalogue.
