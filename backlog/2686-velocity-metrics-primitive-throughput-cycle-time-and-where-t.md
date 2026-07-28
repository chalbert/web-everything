---
bornAs: x4rliv9
kind: story
size: 5
parent: "2505"
status: open
dateOpened: "2026-07-26"
tags: []
scope:
  - we:scripts/readiness/velocity-metrics.mjs
  - we:scripts/readiness/__tests__/velocity-metrics.test.mjs
---

# Velocity metrics primitive — throughput, cycle-time, and where-the-time-goes from item timestamps

Derive per-item and rolled-up velocity from dateStarted→dateResolved + size — throughput (pts/wk), cycle time, and a where-the-time-goes split (in-flight vs waiting/blocked). Reusable beyond the feature-tracking screen (fleet health, conveyor tuning).

Every item already carries dateOpened/dateStarted/dateResolved + size, so this needs no new required fields. Open question: a time-weighted "blocked share" needs status-transition history that is NOT stored today (only the current blockedBy array) — either compute a current-state point-share (and label it as such) or add block-history capture.

Spun off the **feature-tracking-screen** design session (design committee → red-team → refine loop) under epic #2676 (Plateau design-studio). Deferred for a later session. Committee decision-view artifact: https://claude.ai/code/artifact/ba98baf4-3430-47bd-b90b-386be86d529d
