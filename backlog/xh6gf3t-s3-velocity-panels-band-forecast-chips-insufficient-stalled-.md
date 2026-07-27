---
kind: story
size: 5
parent: "2705"
status: open
blockedBy: ["xwmr2vr", "2686", "xmfb69v"]
scope: ["plateau-app:src/feature-tracker/velocity.ts", "plateau-app:src/feature-tracker/velocity.css"]
dateOpened: "2026-07-27"
tags: []
---

# S3 · Velocity panels + band forecast chips + insufficient/stalled/no-basis

12-week throughput sparkline + cycle where-the-time-goes (text twins), fed by #2686, registering into S2's section registry. Band forecast chips (projection allowed). Explicit named surfaces + own baselines for M2 (insufficient), M3 (stalled), and the K6/no-basis velocity panel.

## Deliverable
A 12-week throughput sparkline (SVG area+line, trend arrow) + cycle where-the-time-goes (per-segment text twins), fed by #2686. Registers into S2's section registry (does NOT edit the detail shell). Band forecast chips now that velocity exists. Explicit named surfaces + own baselines for M2 (insufficient), M3 (stalled, stallnote), and the K6/no-basis velocity panel — each honest no-forecast, not a hidden branch.

## FT cases → rendered=yes
M1/M2/M3; K1, K2, K3, K5, K7.

## Scope
- `plateau-app:src/feature-tracker/velocity.ts`
- `plateau-app:src/feature-tracker/velocity.css`

## Acceptance
spark + cycle match baseline in both themes; numbers from #2686; M2/M3/no-basis show none honestly with their own baseline; chips use velocity bands (projection allowed), no forbidden date; chart-anchor conformance (scalars, not path `d`); the SVG re-renders token colours on theme switch.
