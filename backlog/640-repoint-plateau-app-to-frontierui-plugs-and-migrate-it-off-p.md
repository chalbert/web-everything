---
type: issue
workItem: story
size: 5
status: open
blockedBy: ["170"]
dateOpened: "2026-06-14"
tags: []
---

# Repoint plateau-app to @frontierui/plugs and migrate it off plugged bootstrap to unplugged

plateau-app currently aliases @we/plugs (vite.config.mts:119) and imports the plugged @we/plugs/bootstrap (plateau:src/main.ts:9) — a real app on the demo-only plugged path, violating the [Constellation placement](docs/agent/platform-decisions.md#constellation-placement) invariant (origin #606) that real apps use the unplugged surface. Repoint the alias to @frontierui/plugs and migrate plateau-app to unplugged consumption (register/upgrade, no global patching). Blocked on the canonicalization (#170).
