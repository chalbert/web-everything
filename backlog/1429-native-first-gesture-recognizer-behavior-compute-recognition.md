---
kind: story
size: 8
parent: "1396"
locus: frontierui
status: open
blockedBy: []
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
tags: []
---

# native-first gesture recognizer behavior — compute recognition on Pointer Events + touch-action with DI override

Build the default gesture recognizer behavior for the #1428 gesture intent: native-first recognition computed on Pointer Events (+ multi-pointer for pinch/rotate) and touch-action / overscroll-behavior opt-outs, exposed as a behavioral DI / Ambient-Intent seam so the engine (native math vs Hammer.js vs @use-gesture) is swappable. Mirrors hover-intent keeping its mechanic out of the intent. Recognition only — effects live elsewhere (pinch→#1393 viewport, swipe→carousel paging, long-press→contextmenu/command, pan/drag→data-transfer/reorder).

## Pre-flight state-fix (batch-2026-06-21) — locus→frontierui + size 5→8 (mis-flagged + outgrew)

Cascade-freed by #1428 (gesture intent, resolved) and pulled into a batch top-up, then released after
pre-flight:
- **Locus corrected `→ frontierui`.** This is an **impl** (a behavior that *computes* gesture recognition
  on Pointer Events) — runtime, not a contract — so per the constellation statute (#855/#817, WE =
  contracts only; runtime/impl → FUI) it belongs in frontierui, gated there. It had `locus: we`
  (defaulted); set `locus: frontierui`. The gesture *intent* (#1428, the contract) correctly stayed WE.
- **Size 5 → 8 (outgrew).** A FUI grep found **no existing gesture/pointer-recognizer substrate** — this
  is a fully-greenfield engine: native-first recognition for tap · double-tap · long-press · pan · swipe ·
  pinch · rotate (incl. multi-pointer pinch/rotate math) + `touch-action`/`overscroll-behavior` opt-outs +
  the swappable DI/Ambient-Intent seam. That is a focused-session engine build (mirrors #1236 being
  re-sized for greenfield breadth), not a batch-tail item — bumped to 8 so it drops Tier-A and routes to a
  dedicated FUI session. No design fork; purely locus + effort. blockedBy cleared (#1428 resolved).
