---
kind: story
size: 2
status: open
dateOpened: "2026-06-22"
tags: []
---

# Relocate mock-server FUI → Plateau

Per #1565 (we:docs/agent/platform-decisions.md#devtools-placement): fui:tools/mock-server/ is a dev utility run against your own build — an operator-facing surface, so it relocates to plateau-app. Mechanical move; confirm no FUI build/test depends on it as a serve-time impl (if it does, that part stays FUI per impl-is-not-a-standard).
