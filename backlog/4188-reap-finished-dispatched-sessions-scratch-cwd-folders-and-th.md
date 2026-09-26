---
bornAs: x5qketq
kind: story
size: 3
parent: "4075"
status: resolved
scope: ["we:scripts/operations/dispatch-lane-io.mjs"]
dateOpened: "2026-09-25"
dateStarted: "2026-09-26"
dateResolved: "2026-09-26"
tags: []
---

# Reap finished dispatched sessions' scratch cwd folders and their trust entries

PR #2701 (card #4174) moved every dispatched session's cwd to a fresh per-session folder under the workspace's .operations/dispatch directory (we:scripts/operations/dispatch-lane-io.mjs#dispatchSessionCwd) and grants CLI workspace trust for it in the operator's own CLI config (#grantDispatchTrust / #resolveDispatchTrustPath), one entry per dispatch, forever. Nothing removes a folder or its trust entry once that session finishes, so both grow without bound. Reap both once the owning session is finished (same liveness signal we:scripts/conveyor/reconcile-core.mjs#assessLiveness already uses for a session's own state).

## Done when

1. **Executable** — a test shows a reaper function removes a dispatch-scratch folder and its trust entry once the owning session is no longer live, and leaves a still-live session's folder/entry untouched — fails before this lands (no reaper exists) and passes after.
2. **Live proof** — before: count the folders under the workspace's `.operations/dispatch` directory and the trust entries the dispatch grant owns, on a real machine with finished dispatched sessions on record. After running the reaper: both counts drop to only the still-live sessions', with no live session's folder or trust entry removed.
3. **Executable** — `npm run check:standards` reports 0 errors, and the PR's required `test` and `smoke` checks are green.
