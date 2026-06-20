---
kind: story
size: 3
parent: "1257"
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: src/_data/nativeFirstWatch.json
tags: []
---

# Build the platform-standards-watch front-A conformance metric

The L0-to-L1 step for the platform-standards watch (#1257): define and wire a metric counting WE standards that have a shipped native equivalent but do not yet register it as their resolver impl. Makes the next watch run quantitative instead of qualitative. Seed cases from this run: popover, anchor positioning, invoker commands, view transitions, scroll-driven animations, and base-select (#291). Surfaced by the 2026-06-20 platform-standards watch.

## Progress

Resolved 2026-06-20. Built the front-A metric as a curated ledger + gate nudge:

- **Ledger:** we:src/_data/nativeFirstWatch.json — one row per WE standard with a SHIPPED native
  equivalent: `{ id, standard, nativeApi, baseline, registered, trackingItem }`. Seeded with the 6 cases
  from this run (popover #1261, anchor-positioning #1262, invokers #1263, view-transitions #1264,
  scroll-driven-animations #1265, customizable-select/base-select #291), all `registered: false`.
- **Metric:** pure `computeNativeFirstConformance(watch)` in we:scripts/check-standards-rules.mjs →
  `{ total, registered, pending, pendingList }` (only `registered === true` counts as registered).
- **Wired into the standards gate** (we:scripts/check-standards.mjs) as a NUDGE, not an error — the
  registrations are tracked open work (#1261-#1265, #291), so red-gating would block the very batch fixing
  them. Currently surfaces `0/6 registered; 6 pending`.
- **The contract:** each front-A registration item flips its row to `registered: true` (recording the
  locus) at close-out; each front-B run appends a row when a new native capability ships — so the next
  watch run reads a number, not a vibe. 3 unit tests in we:scripts/__tests__/check-standards-rules.test.mjs.

This is the L0→L1 front-A slice of #1257 (front-B discovery sweep + cadence remain as its other carves).
