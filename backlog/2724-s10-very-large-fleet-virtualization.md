---
bornAs: xpm9rzu
kind: story
size: 3
parent: "2705"
status: open
blockedBy: ["2721", "2719"]
scope: ["plateau-app:src/feature-tracker/scan-virtual.ts", "plateau-app:src/feature-tracker/scan.ts"]
dateOpened: "2026-07-27"
tags: []
---

# S10 · Very-large fleet virtualization

Windowed rendering for the large fleet, integrated with the DEC keyboard-model so arrow/Home/End nav + data-uc anchoring survive windowing and window-edge focus stays correct.

## Deliverable
Windowed rendering for the large fleet, integrated with the DEC keyboard-model (aria-activedescendant) so arrow/Home/End nav + `data-uc` anchoring survive windowing (R8).

## FT cases → rendered=yes
S12.

## Scope
- `plateau-app:src/feature-tracker/scan-virtual.ts`
- `plateau-app:src/feature-tracker/scan.ts` (owned re-edit — serialised against S1b and S9)

## Acceptance
The large fleet virtualises without breaking arrow/Home/End nav or `data-uc` anchoring; window-edge focus stays correct; matches baseline; no horizontal body scroll.
