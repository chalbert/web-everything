---
kind: decision
status: open
blockedBy: ["1324"]
dateOpened: "2026-06-20"
tags: []
---

# Revisit whether destructive belongs on level (prominence) or is a separate role

Carved out of #1324. SwiftUI models destructive as a ButtonRole (alongside cancel), not a prominence — suggesting destructive is mis-placed on Action Intent's level (we:src/_data/intents/action.json). It is orthogonal to disposition (a destructive action is usually the affirmative one) and to prominence. Relocating it touches a SHIPPED level value (every block + theme consuming level=destructive), so it is the broader 'level is overloaded' cleanup — its own decision, deliberately out of scope of #1324.
