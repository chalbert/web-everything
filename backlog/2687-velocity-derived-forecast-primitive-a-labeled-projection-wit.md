---
bornAs: x08qg0p
kind: story
size: 5
parent: "2505"
status: open
blockedBy: ["2686"]
dateOpened: "2026-07-26"
tags: []
---

# Velocity-derived forecast primitive — a labeled projection with an honest no-forecast fallback

A projected finish computed from measured throughput, explicitly labeled a FORECAST (never a hand-typed target). Honest state machine — FORECAST / FORECAST·CAVEAT (gated pts) / NO FORECAST (stalled) / TOO NOISY (high variance).

Operator ruling from the design session — forecast ONLY the unblocked remainder; REFUSE a whole-feature date when the critical path is blocked (show "gated on <blocker>" with blocked points called out separately); never divide total open points by a velocity that excludes blocked epics and present it as a whole-feature date. Open question: the exact thresholds — the too-noisy variance cutoff, the stalled-days cutoff, and whether blocked epics are excluded from the throughput used. Depends on the velocity metrics primitive.

Spun off the **feature-tracking-screen** design session (design committee → red-team → refine loop) under epic #2676 (Plateau design-studio). Deferred for a later session. Committee decision-view artifact: https://claude.ai/code/artifact/ba98baf4-3430-47bd-b90b-386be86d529d
