---
kind: story
size: 3
parent: "2301"
status: open
blockedBy: ["xfky4a0"]
dateOpened: "2026-07-09"
tags: []
---

# Land the memory-lane diff via a deterministic hook on Stop/close — no agent-run /pr

A deterministic hook (Stop / loop-tick / close-session) commits the dedicated memory-lane's agent-memory-src diff and opens a ready-to-merge PR on the standard transport (we:scripts/pr-land.mjs + the drain), reusing the close-session §1a survivors-ride-a-lane path — the agent never runs /pr for memory. Blocked by the repoint slice (nothing to land until memory writes resolve to the lane). Slice of #2301.
