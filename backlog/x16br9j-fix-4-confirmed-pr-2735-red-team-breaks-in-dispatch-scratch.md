---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/session-reaper.mjs", "we:scripts/conveyor/__tests__/session-reaper.test.mjs", "we:scripts/lib/atomic-json-file.mjs", "we:scripts/lib/__tests__/atomic-json-file.test.mjs"]
dateOpened: "2026-09-26"
tags: []
---

# Fix 4 confirmed PR #2735 red-team breaks in dispatch-scratch reap + withFileLock (#4188 follow-up)

Post-accept red team (PR #2735) on merged PR #2726 (#4188/x5qketq, dispatch-scratch reap + trust cleanup) confirmed 5 breaks. Fixes 4 here: (1) MOST SERIOUS — Path A of we:scripts/conveyor/session-reaper.mjs's classifyDispatchScratchEntry (the dispatch-scratch sweep) reaped an unregistered/finished folder past its 24h grace WITHOUT ever consulting liveCwdInUse, so a live long-running session's folder could be deleted if its row drifted out of the claude-agents listing; now gated on not-liveCwdInUse like path B already was. (2) we:scripts/lib/atomic-json-file.mjs's withFileLock used a plain unlinkSync stale-lock takeover, letting a caller act on a decision that had gone stale (a sibling could have already fully stolen and re-acquired a fresh, live lock at the same path in the gap) — now a rename-based atomic claim with pid-liveness probing and post-move re-verification and restore. (3) writeJsonAtomic replaced a symlinked target, such as the operator's per-project CLI config file, with a plain file on rename — now resolves the symlink first and writes through it. (4) writeJsonAtomic left its temp file behind when the final rename failed — now cleaned up on that path too. Finding 5 (grantDispatchTrust in we:scripts/operations/dispatch-lane-io.mjs still writes non-atomically) is DEFERRED to a separate follow-up card since open PR #2732, which also edits we:scripts/operations/dispatch-lane-io.mjs, had not merged at filing time.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
