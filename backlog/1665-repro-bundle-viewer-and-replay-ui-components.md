---
kind: story
size: 5
parent: "1663"
status: open
blockedBy: ["1664"]
locus: frontierui
dateOpened: "2026-06-23"
tags: []
---

# Repro-bundle viewer and replay UI components

Build the FUI components the plateau dev-browser tool composes to view and replay a repro bundle: a bundle inspector that renders the declared-state snapshot, the declared rules and the ownership map; a replay timeline that steps through the action trace; and ownership chips surfacing who owns each node so a recipient can self-route. Pure presentation over the #1664 contract shape — no capture dependency. Lands as FUI components (fui:) consumed by the plateau export+replay tool.
