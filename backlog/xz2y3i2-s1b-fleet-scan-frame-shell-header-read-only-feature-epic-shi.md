---
kind: story
size: 5
parent: "2705"
status: open
blockedBy: ["xizryfp", "xmfb69v"]
scope: ["plateau-app:src/feature-tracker/mount.ts", "plateau-app:src/feature-tracker/feature-tracker.css", "plateau-app:src/feature-tracker/scan.ts", "plateau-app:src/feature-tracker/scan.css", "plateau-app:src/feature-tracker/data.ts"]
dateOpened: "2026-07-27"
tags: []
---

# S1b · Fleet-scan frame + shell + header (read-only, feature≈epic) — ships first

App shell + fleet header (structural metrics + theme toggle, velocity/forecast shown honest 'no basis yet') + persistent left SCAN listbox with roving-tabindex nav. Owns the mock fleet data module including the Drain Daemon honesty fix. Renders the K6 no-basis chip. Pre-builds the header banner slot. First usable increment.

## Deliverable
App shell + fleet header (structural metrics + theme toggle; velocity/next-landing shown honest "no basis yet") + a persistent left SCAN: one-line rows (kind glyph, where-the-time-goes segmented bar with a pts text twin, %, filter chips), roving-tabindex listbox nav (per the DEC keyboard-model). Pre-build the header BANNER SLOT (S8). Owns the mock fleet data module including the Drain Daemon fix. Renders the K6 no-basis forecast chip. SHIPS FIRST — the first usable increment, behind S1a + DEC, before #2691, faking no number.

## FT cases → rendered=yes
S1, S11; F1–F12; K6, K8 (from EDGES), K9.

## Scope
- `plateau-app:src/feature-tracker/mount.ts`
- `plateau-app:src/feature-tracker/feature-tracker.css`
- `plateau-app:src/feature-tracker/scan.ts`
- `plateau-app:src/feature-tracker/scan.css`
- `plateau-app:src/feature-tracker/data.ts`

## Acceptance
The ≤31-row scan matches the frozen baseline in both themes; every row carries `data-uc` + an accessible name; velocity/forecast show honest "no basis yet" not fabricated numbers; structural chips render NO date; filters + arrow/Home/End/Enter nav work; the K6 chip renders; the Drain Daemon row shows `gated`, no date; the header banner slot is present.
