---
bornAs: xdf1ccd
kind: story
size: 8
parent: "4795"
status: open
blockedBy: ["4919"]
scope: ["we:scripts/operations/health-responder-pr.mjs", "we:scripts/operations/__tests__/health-responder-pr.test.mjs", "we:scripts/conveyor/health-responder.mjs", "we:scripts/conveyor/__tests__/health-responder.test.mjs", "we:scripts/conveyor/health-watch.mjs", "we:scripts/conveyor/__tests__/health-watch.test.mjs", "we:scripts/conveyor/health-smells/pr-no-owner.mjs", "we:scripts/conveyor/health-smells/__tests__/pr-no-owner.test.mjs", "we:scripts/review-set-label.mjs", "we:scripts/__tests__/review-set-label.test.mjs", "we:scripts/operations/promote-draft-pr-dispatch.mjs", "we:scripts/operations/__tests__/promote-draft-pr-dispatch.test.mjs", "we:scripts/conveyor/__tests__/rearm-review.test.mjs", "we:scripts/conveyor/__tests__/fixtures/health-responder/pr-routing.json"]
dateOpened: "2026-10-02"
preparedDate: "2026-10-02"
tags: [conveyor, health]
---

# Health responder: restore PR review routing and promote drafts

Implement the disabled PR-routing adapter from epic #4795: targeted fresh-head draft promotion and conservative restoration of a missing review hold through the existing shared label writer, never acceptance. Extend the watch pr-no-owner evidence for unlabeled automation-owned post-heal PRs. Replay D1-D2 and L1-L7, including stale marker, human hold and live claim races. Grounding: we:scripts/operations/promote-draft-pr-dispatch.mjs:138; we:scripts/review-set-label.mjs:343; we:scripts/conveyor/health-smells/pr-no-owner.mjs:63.


## Implementation contract

Slice 2 of epic #4795. Apply its full action catalogue, safety, escalation and measurement contract in we:backlog/4795-health-responder-a-daemon-that-acts-on-health-signals-not-on.md. The current-source references below establish existing behavior; proposed files/limits describe work still owed.

Add the PR adapter behind the disabled per-smell setting. This story owns the missing-route detection seam as well as the existing actuator composition; the responder does not discover PRs itself.

- Extend watch `pr-no-owner` with the epic's structured `missing-review-route` reason. Require four complete observations of an open automation-owned, post-heal PR with no review route, live owner or terminal hold; capture current head and trusted marker identity. Keep the descriptor-wide four-sample refusal rule unchanged; the framework has no per-result hysteresis override (we:scripts/conveyor/health-watch-core.mjs:360). Extend the existing watch PR projection to carry current head, trusted ownership/marker provenance and coverage status; currently it projects comments but omits head SHA (we:scripts/conveyor/health-watch.mjs:518, we:scripts/conveyor/health-watch.mjs:523). Partial/truncated reads are unknown, not absent labels. Current coverage gap: we:scripts/conveyor/health-smells/pr-no-owner.mjs:33, we:scripts/conveyor/health-smells/pr-no-owner.mjs:63; zero labels are also absent from we:scripts/conveyor/health-smells/review-label-conflict.mjs:30.
- Add a narrow restore-hold target to the existing shared label writer, using the existing producer escalation rubric on the current complete diff. Human-required -> human hold; otherwise pending. No accepted/restamp/clear-human target is exposed. Refuse live verdict/hold, unresolved stand-down, untrusted/incomplete input or changed head. Do not broaden `rearm` to silently invent a missing hold: current rearm requires changes/accepted (we:scripts/review-set-label.mjs:343); producer rubric is at we:scripts/pr-land.mjs:569. Add episode attribution to the shared comment/log path without changing durable marker prefixes.
- Promote only through `runReconcilePromoteDraftDispatch` with an explicit target repo/PR and expected head, current draft status, current required checks and no intentional fix/withdrawal hold. Its current per-SHA fresh check exists at we:scripts/operations/promote-draft-pr-dispatch.mjs:138. Add target/head narrowing and common serialization there so the ordinary daemon and responder use the same boundary. Do not call the whole-fleet pass or raw ready/edit commands.
- Re-arm only a proved completed repair/stale acceptance through the existing rearm path; keep human as the sole hold. Never call `ci-heal-mark` to manufacture repair evidence. Current handback text and invariant: we:scripts/conveyor/rearm-review.mjs:124; we:scripts/conveyor/ci-heal-mark.mjs:73.
- Enforce one attempt per episode/head/family plus the epic's cross-smell PR/hour/day caps. Verify the actual fresh draft/hold after writing. Ambiguous write consumes the reservation and requires observation, not an automatic retry. All adapters remain disabled until slice 6.

## Scope boundary

13 scope paths, three areas: we:scripts/operations/, we:scripts/conveyor/, the shared label writer and its tests in we:scripts/. Frontmatter is the explicit predicted touch set; do not widen it silently. Backlog delivery metadata is administrative, not another implementation area. Read-only references outside scope are not permission to edit those files. No shared agent-document edits. Changes to existing shared actuators stay in their existing owner, with their existing tests.

This is independently deliverable after slice 1: the adapter and its detector extension land disabled, with injectable contract tests; actual live enablement belongs to slice 6. The shared responder-shell path intentionally makes overlapping sibling wiring serialize in the lane planner.

## Test plan and replay

Include an explicit unresolved stand-down and intentional-withdrawal negative: neither restore-hold nor promotion may write. A review-loop resume comes only from #4922's operator-resolution ceremony through this same promotion owner; ordinary draft detection cannot clear that hold.

D1/D2 (#3336/#3311), L1–L7 (#3239/#3389/#3390/#3391/#3392/#3463/#3471). Assert one promotion only when fresh current-head checks are green; intentional draft/fix hold blocks it. #3389 supplies a stale marker/current-head mismatch. Test live human label and live fix claim arriving between read/write, incomplete diff, unknown actor, ambiguous response, current target already satisfied and restart. Label restoration must use the actual escalation rubric for source, docs, config, data and statute/leash diffs; no test may equate backlog-only with agent clearance.

Primary executable checks (new test entrypoints are expected to be absent before this story):

```bash
responder_test_1='we:scripts/operations/__tests__/health-responder-pr.test.mjs'
responder_test_2='we:scripts/__tests__/review-set-label.test.mjs'
responder_test_3='we:scripts/conveyor/health-smells/__tests__/pr-no-owner.test.mjs'
responder_test_4='we:scripts/operations/__tests__/promote-draft-pr-dispatch.test.mjs'
responder_test_5='we:scripts/conveyor/__tests__/rearm-review.test.mjs'
responder_test_6='we:scripts/conveyor/__tests__/health-watch.test.mjs'
npx vitest run "${responder_test_1#we:}" "${responder_test_2#we:}" "${responder_test_3#we:}" "${responder_test_4#we:}" "${responder_test_5#we:}" "${responder_test_6#we:}"
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
