---
kind: story
size: 5
parent: "xdmqryh"
status: open
blockedBy: ["xuznx3v", "xdf1ccd", "xtrb2ya", "xiek6my", "x8d8wlw"]
scope: ["we:scripts/conveyor/health-responder.mjs", "we:scripts/conveyor/health-responder-state.mjs", "we:scripts/conveyor/__tests__/health-responder.test.mjs", "we:scripts/conveyor/__tests__/health-responder-state.test.mjs", "we:scripts/conveyor/health-watch.mjs", "we:scripts/conveyor/health-watch-core.mjs", "we:scripts/conveyor/__tests__/health-watch.test.mjs", "we:scripts/conveyor/__tests__/health-watch-core.test.mjs", "we:scripts/conveyor/health-watch-section.mjs", "we:scripts/conveyor/__tests__/health-watch-section.test.mjs", "we:scripts/conveyor/health-notification-receipts.mjs", "we:scripts/conveyor/__tests__/health-notification-receipts.test.mjs", "we:scripts/conveyor/__tests__/fixtures/health-responder/go-live.json", "we:skills-src/conveyor/launchd/com.we.health-responder.plist.example"]
dateOpened: "2026-10-02"
preparedDate: "2026-10-02"
tags: [conveyor, health]
---

# Health responder: prove canaries and enable actions per smell

Complete the epic #xdmqryh rollout with strict disabled/shadow/live-per-smell settings, fail-closed kill switch, durable shared watch notification receipts and per-smell measurements. Prove a 24-hour shadow soak and one isolated canary per enabled smell before an explicit operator settings change; preserve all existing owner gates. Replay every case and watch/responder restart, lost-write and kill-switch races. Grounding: we:scripts/conveyor/health-watch.mjs:948; we:scripts/readiness/dispatch-pause.mjs:30; we:docs/agent/platform-decisions.md:5726.


## Implementation contract

Slice 6 of epic #xdmqryh. Apply its full action catalogue, safety, escalation and measurement contract in we:backlog/xdmqryh-health-responder-a-daemon-that-acts-on-health-signals-not-on.md. The current-source references below establish existing behavior; proposed files/limits describe work still owed.

Complete the strict control plane, shared operator notification receipt and measured rollout after all action families have landed disabled. This story implements/test-proves the switch; actual host installation and per-smell settings changes require the operator rollout instruction at that time.

- Publish effective config with default disabled/shadow and explicit per-smell live allowlist. Invalid config or unreadable journal freezes mutations. Re-read the kill switch before every effect and job admission. Killing admission does not kill an existing worker or undo a completed action. Preserve ordinary daemon ownership and budgets. Show the actual configured dispatch-pause path; review dispatch is not covered by that existing switch (we:scripts/readiness/dispatch-pause.mjs:30, we:scripts/readiness/dispatch-pause.mjs:234).
- Keep `notifyDesktopChecked` in the watch as the only desktop send owner. Join responder escalation intent/results into the HEALTH read surface. Add a durable receipt keyed by full episode identity, atomically reserved before send, with delivered/ambiguous/pre-send-failed/migrated status. Share it across existing watch alerts and responder escalation; do not send a second message after an initial watch alert. Sources: we:scripts/conveyor/health-watch.mjs:948; we:scripts/conveyor/health-watch-section.mjs:60.
- Final delivery guard requires high severity and no active silence. Existing reminder/silence-expiry transitions currently can notify again (we:scripts/conveyor/health-watch-core.mjs:430, we:scripts/conveyor/health-watch-core.mjs:481); suppress extra sends for responder-enrolled episodes to meet this job’s one-message contract. Do not silently change other watch episodes. On migration mark existing open episodes delivery-unknown and queue-only, never flood the operator. Clearly failed pre-send attempts may retry; ambiguous sends never do automatically.
- Render plain language: subject, observed problem, bounded action/refusal, limit and next human decision, PR/report links. Medium/low stays report-only. Never use an agent message/PR comment as approval. Keep watch mode/investigation/file switches independent, honoring we:docs/agent/platform-decisions.md:5726.
- Provide time-to-attend, time-to-unstick, censored open ages, recurrence, successes/refusals/unknown, actions per success, per-smell counts and duplicate notifications, with config version and sampling precision. Use timeline/actuator postconditions, not episode closure alone. All timers and receipt clocks must be replayable.
- Execute a 24-hour shadow soak with zero external writes, then isolated test-PR/fixture-lane canaries with independent observed postconditions. Order: promotion, missing-route hold, CI, dead lanes/claims, review. One repo/smell/subject at a time; a smell with no eligible canary stays shadow. Unit tests alone never justify broad enablement. On unintended write, forbidden transition or duplicate notification, disable the affected smell and preserve its evidence; do not overwrite an operator pause or disable existing owners.

## Scope boundary

14 scope paths, two areas: we:scripts/conveyor/ and we:skills-src/conveyor/. Frontmatter is the explicit predicted touch set; do not widen it silently. Backlog delivery metadata is administrative, not another implementation area. Read-only references outside scope are not permission to edit those files. No shared agent-document edits. Changes to existing shared actuators stay in their existing owner, with their existing tests.

This depends on all five earlier slices; do not partially enable a smell whose action, audit or refusal path is incomplete.

## Test plan and replay

All D/L/C/R/LANE/CLAIM fixtures, plus an existing watch alert followed by responder failure (one total notification), same-tick severity escalation/reminder/expiry, medium tracked episode, cold upgrade, notification crash after send, corrupt budget/config, two instances and kill switch flipped immediately before submit. Kill switch must block review actions even though dispatch-pause does not. #3311’s watch closure-before-ready event is mandatory in metric tests; #3415 containment must not be counted as recovery.

Primary executable checks (new test entrypoints are expected to be absent before this story):

```bash
responder_test_1='we:scripts/conveyor/__tests__/health-responder.test.mjs'
responder_test_2='we:scripts/conveyor/__tests__/health-responder-state.test.mjs'
responder_test_3='we:scripts/conveyor/__tests__/health-notification-receipts.test.mjs'
responder_test_4='we:scripts/conveyor/__tests__/health-watch.test.mjs'
responder_test_5='we:scripts/conveyor/__tests__/health-watch-core.test.mjs'
responder_test_6='we:scripts/conveyor/__tests__/health-watch-section.test.mjs'
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
4. **Observable:** shadow-soak and isolated canary evidence, effective settings and before/after metrics are recorded; no smell is live without the operator’s explicit settings change and its own proved canary.

## Follow-ups

Record replay limitations, observed product gaps and testing lessons here. Do not append to shared agent docs or silently add a new automatic action beyond the epic’s catalogue.
