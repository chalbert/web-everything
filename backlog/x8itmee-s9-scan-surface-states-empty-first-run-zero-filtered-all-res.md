---
kind: story
size: 3
parent: "2705"
status: open
blockedBy: ["xz2y3i2"]
scope: ["plateau-app:src/feature-tracker/states.ts", "plateau-app:src/feature-tracker/scan.ts"]
dateOpened: "2026-07-27"
tags: []
---

# S9 · Scan-surface states — empty / first-run / zero-filtered / all-resolved / skeleton / error

Non-happy scan surfaces (scan-only): empty-fleet, first-run no-velocity (S9), filtered-to-zero (clear-filter), all-resolved (S13, header dashes), initial skeleton (L1), scan-load-failure (E1: retry + honest absence). Each an explicit deliverable with its own baseline.

## Deliverable
Non-happy scan surfaces (need only the scan): empty-fleet, first-run no-velocity (S9), filtered-to-zero (clear-filter), all-resolved (S13, header dashes not stale numbers), initial skeleton (L1), scan-load-failure (E1: retry + honest absence). Each an explicit deliverable with its own baseline.

## FT cases → rendered=yes
S8, S9, S10, S13; E1; L1 (the rest of E/L stay spec).

## Scope
- `plateau-app:src/feature-tracker/states.ts`
- `plateau-app:src/feature-tracker/scan.ts` (owned re-edit — serialised against S1b and S10)

## Acceptance
Each matches baseline in both themes; the header shows dashes not stale numbers on empty/complete/first-run; clear-filter returns to All; E1 offers retry + honest absence (no stale/made-up numbers); the skeleton is ~9+ shimmer rows, no banner.
