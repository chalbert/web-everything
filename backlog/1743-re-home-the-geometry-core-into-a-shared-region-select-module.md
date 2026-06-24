---
kind: story
size: 3
parent: "1734"
status: open
blockedBy: ["1742"]
dateOpened: "2026-06-24"
tags: []
---

# Re-home the geometry core into a shared region-select module + rect realization

FUI slice (locus fui:). Generalize the rect-only geometry core at fui:blocks/marquee-select/marqueeMath.ts (bandRect, hitTest over MarqueeMode, hitIds, resolveSelection over the modifier vocab, modifierFromEvent, passedThreshold) into a shared region-select geometry module with a shape-dispatched hit-test, and re-point the #1406 marquee-select block as the rect member declaring shape: rect against the #1742 intent contract. The non-rect members consume this module's shared helpers. Blocked by #1742 (declares against the intent dimension values). Demoable + regression-safe: marquee-select behaves identically (rect via the new module). First FUI slice; unlocks C+D.
