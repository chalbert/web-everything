---
bornAs: x2psfwz
kind: story
size: 2
parent: "4075"
status: resolved
relatedTo: ["3721"]
scope: ["we:scripts/lane-pool.mjs", "we:scripts/conveyor/lease-reaper.mjs", "we:scripts/operations/completion-record.mjs"]
dateOpened: "2026-09-24"
dateStarted: "2026-09-24"
dateResolved: "2026-09-24"
graduatedTo: "we:scripts/lane-pool.mjs"
tags: []
---

# Session-name reuse across attempts: release/reaper/completion-record keyed by name alone, not by owning Claude session

review-<PR> / fix-<PR> session names carry no attempt suffix (we:scripts/conveyor/session-slug.mjs's mintSessionSlug explicitly forbids an attempt for PR kinds), so a round-2 dispatch reuses the exact same name as round 1. we:scripts/lane-pool.mjs's cmdReleaseAllPools --session=review-N can drop a live round-2 session's lease if a round-1 record lingers; we:scripts/conveyor/lease-reaper.mjs's sessionStateByName does byName.set(s.name, state) over a listing in CLI order, so a stale/duplicate row for the same name can shadow the live one depending on order, not recency; and a stale done completion record for the old name can read as true for the new session. Fix: scope release/reap decisions by the owning Claude session id (ownerSession / CLAUDE_CODE_SESSION_ID, which the lease already records per #2997) rather than by session name alone wherever a round-2 reuse is possible; delete or version the completion record at dispatch time so a new round never inherits the prior round's terminal record.

## Done when

1. **Executable** — `npx vitest run we:scripts/conveyor/__tests__/lease-reaper.test.mjs` carries the
   duplicate-name `sessionStateByName` cases (a terminal row never masks an already-recorded live one,
   regardless of listing order); `npx vitest run we:scripts/__tests__/lane-pool-release-owner-session-scope.test.mjs`
   proves `release --all-pools --session=<name> --owner-session=<id>` never drops a different round's live
   lease; `npx vitest run we:scripts/operations/__tests__/dispatch-claude-provider-completion-reset.test.mjs`
   proves `defaultClaudeProvider` deletes a PR_KIND session's stale completion record before spawning. All
   fail before this fix, pass after.
