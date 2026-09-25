---
bornAs: xltlavt
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/session-reaper.mjs", "we:.claude/settings.json"]
dateOpened: "2026-09-24"
tags: []
---

# Record which chat spawned a background session so cleanup can scope to it

Build clause 4 of #conveyor-session-lifecycle-policy (#4082). Nothing links a chat-spawned background session to the chat that spawned it, so cleanup can only touch daemon-dispatched sessions. Stamp the spawning session at spawn time, and let the session reaper include a chat-spawned session only when that link exists and the spawning chat was explicitly ended (never on idle or disconnect). Unknown or ambiguous links are never reaped.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
