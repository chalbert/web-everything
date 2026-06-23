---
kind: story
size: 8
parent: "142"
status: open
locus: plateau-app
blockedBy: ["1667"]
dateOpened: "2026-06-23"
tags: []
---

# Live contract and data inspector at provider/context seams (dev browser)

Build story for the live contract/data inspector (#1632, ratified go — cluster's cleanest delta). At each provider/context seam show the declared contract beside the live value and validate continuously, flagging the offending path on drift. Seam topology is introspectable (#400 resolved); the over-time/snapshot half is blocked by #1667 (trace/replay), and a residual needs each seam to declare a contract shape (webcontexts does not yet). Registers against the #1636 lens primitive. Home plateau:dev-browser.
