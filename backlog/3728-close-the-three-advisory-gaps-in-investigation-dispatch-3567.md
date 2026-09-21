---
bornAs: xm1q79e
kind: story
size: 5
parent: "3029"
status: open
scope: ["we:scripts/conveyor/tick-core.mjs", "we:scripts/conveyor/lease-reaper.mjs", "we:scripts/conveyor/session-reaper.mjs", "we:scripts/operations/file-item.mjs", "we:scripts/conveyor/queue.mjs", "we:scripts/operations/__tests__/dispatch-lane.test.mjs", "we:scripts/conveyor/__tests__/tick-core.test.mjs", "we:scripts/conveyor/__tests__/lease-reaper.test.mjs", "we:scripts/conveyor/__tests__/session-reaper.test.mjs", "we:scripts/operations/__tests__/file-item.test.mjs", "we:scripts/conveyor/__tests__/queue.test.mjs"]
dateOpened: "2026-09-19"
tags: []
---

# Close the three advisory gaps in investigation dispatch (#3567 follow-up)

Investigation dispatch gained a new session name and backlog kind without updating all cleanup and queueing rules. Merge watchers release the wrong lease, and reapers miss investigation sessions. Agents can also file child investigations that start without human arming. Failed investigations have no attempt cap, so guard retirement allows repeated runs. Together these gaps tie up lanes and allow uncontrolled agent work.

This story follows up #3567 (PR #2058, merged). The operator accepted the three findings below without fixes. Its parent is epic #3029, operation engine.

## Findings

1. **Investigation sessions escape cleanup.** `sessionSlugFor` mints `investigate-<id>` at `we:scripts/operations/dispatch-lane.mjs:350`. However, `releaseSessionForNum` falls back to `conveyor-<num>` at `we:scripts/conveyor/tick-core.mjs:832`. `armWatchers` passes that wrong slug to the merge watcher. The parsers at `we:scripts/conveyor/lease-reaper.mjs:113` and `we:scripts/conveyor/session-reaper.mjs:162` also omit `investigate-`. A slug that these consumers cannot recognise leaves a lane lease or background session unreleased or unreaped. The lease loses its PR-state cleanup signal and item-based release path, leaving any bare TTL as the fallback. **Prevention owed:** extend the consumers and add a contract test over every `LAUNCH_KINDS` member. Each minted slug must round-trip through the cleanup consumers, with explicit treatment for PR-keyed kinds. Release slugs must agree with dispatch slugs for live guards.

2. **Agents can start child investigations without human arming.** `BACKLOG_KINDS` accepts `investigation` at `we:scripts/check-standards-rules.mjs:155`. The exclusion list at `we:scripts/operations/file-item.mjs:76` contains only `epic` and `decision`. Consequently, `planQueueing` returns `queueing: true` for an open investigation. The warning map at `we:scripts/conveyor/queue.mjs:50` has the same omission. An investigation agent can file child investigations that are auto-cleared and dispatched without human arming. Those runs can fan out until lanes or budget are exhausted. **Prevention owed:** make `planQueueing` refuse automatic queueing for investigations and add the matching queue warning. Explicitly classify every backlog kind as auto-queueable or non-dispatchable through this filing path. Decisions and investigations must not gain automatic arming through agent filing.

3. **Investigation retries have no attempt cap.** `retirePrepareGuards` retires investigation guards on `pr-terminal` or `ttl` at `we:scripts/conveyor/tick-core.mjs:515`. The same tick calls `planPrepareSpawns` with only surviving guards at `we:scripts/conveyor/tick-core.mjs:1173`. Its admission checks contain no attempt counter. An unanswerable investigation or one whose gate stays red can therefore restart once per TTL when no PR appears. A closed, unmerged PR also permits another run once its guard retires. Unlike fix guards and their `fixAttempts`, these runs have no upper bound. **Prevention owed:** add a per-item investigation attempt cap and a repeated retire/spawn test. A generic counter for every launch-guard kind is a longer-term extension.

## Done when

1. `we:scripts/operations/__tests__/dispatch-lane.test.mjs` iterates `LAUNCH_KINDS` and calls `sessionSlugFor(num, kind, pr)` for each kind. Item-keyed slugs round-trip through both `itemNumFromSession` and `sessionTarget`. `releaseSessionForNum` returns the same slug for a live guard of each item-keyed kind. PR-keyed kinds have explicit assertions for their PR identity and cleanup contract. Adding a kind without wiring its consumers makes this test fail.

2. `we:scripts/conveyor/__tests__/tick-core.test.mjs` asserts that `armWatchers` releases `investigate-<num>` for a live investigation guard. `we:scripts/conveyor/__tests__/lease-reaper.test.mjs` verifies investigation parsing and PR-state lease cleanup. `we:scripts/conveyor/__tests__/session-reaper.test.mjs` verifies that a resolved investigation makes its background session eligible for ground-truth reaping. Removing investigation support makes these tests fail.

3. `we:scripts/operations/__tests__/file-item.test.mjs` asserts that `planQueueing({ kind: 'investigation', status: 'open' })` refuses queueing, including when queueing is explicitly requested. An agreement test covers every `BACKLOG_KINDS` member with exactly one explicit classification. It checks that decisions and investigations cannot auto-queue and that the non-dispatchable set matches the queue map. `we:scripts/conveyor/__tests__/queue.test.mjs` checks the investigation warning. Removing either exclusion or its matching entry makes a test fail.

4. `we:scripts/conveyor/__tests__/tick-core.test.mjs` runs N retire/spawn cycles for a permanently held investigation, with N greater than the configured per-item cap. It covers both TTL retirement and closed, unmerged PR retirement. Total spawns never exceed the cap, even when a lane remains available. Removing the cap or resetting its counter during retirement makes the test fail.

## Out of scope

No change to `we:scripts/operations/explore.mjs`; the `isPreScopeGateKind` predicate follow-up mentioned on PR #2058 is separate.
