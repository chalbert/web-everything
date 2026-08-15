---
bornAs: xxmgsqq
kind: story
size: 5
parent: "2705"
status: open
blockedBy: ["2727", "2718"]
scope: ["plateau-app:src/feature-tracker/burnup.ts", "plateau-app:src/feature-tracker/burnup.css", "plateau-app:src/feature-tracker/forecast.ts"]
dateOpened: "2026-07-27"
tags: []
---

# S4 · Burn-up + honest-forecast projection + gated hatched band + no-forecast

Burn-up capped at the unblocked ceiling, hatched gated-no-date band, dashed projection to the ceiling (not a date), now-marker, milestone chips. Consumes #2718 (forecast primitive; #2687 superseded per #3125). Explicit named surface + own baseline for M6 (no-forecast). Registers into the section registry; honest-forecast DOM guard passes.

## Deliverable
Burn-up capped at the unblocked ceiling, a hatched gated-no-date band above, a projection dashed to the ceiling (not a date), a "now" marker, milestone chips (a gated milestone reads `gated · no date`). Consumes #2718 (forecast primitive; #2687 superseded per #3125); a blocked feature projects only its unblocked remainder. Explicit named surface + own baseline for M6 (no-forecast: delivered curve only, no projection). Registers into the section registry.

## FT cases → rendered=yes
M4–M7 (+M8 spec); M18–M21 (+M22/M23 spec); K4.

## Scope
- `plateau-app:src/feature-tracker/burnup.ts`
- `plateau-app:src/feature-tracker/burnup.css`
- `plateau-app:src/feature-tracker/forecast.ts` (owned re-edit)

## Acceptance
A gated feature caps at the ceiling with a hatched band labelled `gated · no date`, NO date on gated points; M6 draws the delivered curve only with an honest note + own baseline; on-track projects to total; hatch-over-solid is colourblind-distinct; matches baseline in both themes; the honest-forecast DOM guard passes (no date on any blk/gated projection endpoint); chart-anchor conformance.
