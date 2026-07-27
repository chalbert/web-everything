---
bornAs: xwmr2vr
kind: story
size: 3
parent: "2705"
status: open
blockedBy: ["2721"]
scope: ["plateau-app:src/feature-tracker/detail.ts", "plateau-app:src/feature-tracker/detail.css"]
dateOpened: "2026-07-27"
tags: []
---

# S2 · Detail shell + section registry + tabs + sub-line + empty/leaf

Thin detail shell with a data-driven section registry (velocity/burnup/rollup self-register to identical ratified DOM), master-detail wiring, back button on narrow, two ARIA tabs with roving tabindex, honest sub-line, nothing-selected + leaf. Pre-builds the dependencies-tab content slot.

## Deliverable
A thin detail shell with a data-driven section registry (velocity/burnup/rollup self-register → identical ratified DOM). Master-detail wiring, back button on narrow, two tabs (Drill&velocity / Dependencies) with ARIA + roving tabindex, a sub-line (next-landing rendered honestly), nothing-selected + leaf. Pre-build the DEPENDENCIES-TAB CONTENT SLOT (S7).

## FT cases → rendered=yes
S2, S3, S4, S15, S16.

## Scope
- `plateau-app:src/feature-tracker/detail.ts`
- `plateau-app:src/feature-tracker/detail.css`

## Acceptance
Row select opens detail + moves focus to the title; nothing-selected + leaf match baseline; a gated feature's next-landing shows "gated — no date", never a date; a tab switch keeps visual + ARIA in lockstep; the registry accepts registrations; the dep-tab slot is present.
