---
bornAs: xltlavt
kind: story
size: 3
parent: "4075"
status: resolved
scope: ["we:scripts/conveyor/session-reaper.mjs", "we:.claude/settings.json"]
dateOpened: "2026-09-24"
dateStarted: "2026-09-25"
dateResolved: "2026-09-25"
graduatedTo: main
tags: []
---

# Record which chat spawned a background session so cleanup can scope to it

Build clause 4 of #conveyor-session-lifecycle-policy (#4082). Nothing links a chat-spawned background session to the chat that spawned it, so cleanup can only touch daemon-dispatched sessions. Stamp the spawning session at spawn time, and let the session reaper include a chat-spawned session only when that link exists and the spawning chat was explicitly ended (never on idle or disconnect). Unknown or ambiguous links are never reaped.

## Done when

1. **Executable** — `npx vitest run we:scripts/conveyor/__tests__/session-reaper.test.mjs` fails before this item lands (missing `writeChatSpawnLink`/`tryReadChatSpawnLink`/`markChatEnded`/`isChatEnded`/`classifyChatSpawnGuard`/`makeChatSpawnGuardResolver`/`runStampChatSpawnHook`/`runMarkChatEndedHook` exports, and `classifySessionReap` never blocks a `done` session on a not-yet-ended spawning chat) and passes after. Live: `node we:scripts/conveyor/session-reaper.mjs stamp-chat-spawn`/`mark-chat-ended`, invoked with real stdin + `CLAUDE_CODE_SESSION_ID`, write real files the reaper's own guard resolver reads back correctly.
