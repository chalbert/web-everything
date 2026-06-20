---
kind: story
status: resolved
size: 2
blockedBy: ["1175"]
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "intent:fullscreen"
relatedProject: webportals
tags: [deck, fullscreen, wake-lock, webportals, general]
relatedReport: reports/2026-06-19-deck-slide-standards.md
---

# Fullscreen presentation mode (Fullscreen API + cursor-hide + Wake Lock)

A **fullscreen presentation-surface** capability — Fullscreen API + cursor-hide + Screen Wake Lock. A semantic + intent homed in **webportals** (a `fullscreen` semantic). **General, not deck-specific** — video, image, and app surfaces want it too. *New contract.* (Patches a coverage gap the relatedReport omitted.)

*Carved from epic #1173 under the ratified distributed placement (#1175 → B, no webdecks project); homed by its kin per the contract-inventory table.*

## Progress (batch-2026-06-20-deck)

Authored intent `fullscreen` in **webportals** (`we:src/_data/intents/fullscreen.json`): the presentation-surface capability bundling Fullscreen API + cursor auto-hide + Screen Wake Lock; axes `scope` (element/document), `cursor` (auto-hide/visible), `wakeLock` (held/none). General (video/image/kiosk/deck), homed as a surface capability per #1175 — patches a coverage gap the deck survey surfaced. User-gesture + wake-lock-lifecycle notes included. Auto-renders at `/intents/fullscreen/`.
