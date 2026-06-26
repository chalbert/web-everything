---
kind: story
size: 3
parent: "1734"
status: resolved
dateOpened: "2026-06-24"
dateStarted: "2026-06-26"
dateResolved: "2026-06-26"
graduatedTo: 1734
tags: []
---

# Re-home the geometry core into a shared region-select module + rect realization

FUI slice (locus fui:). Generalize the rect-only geometry core at fui:blocks/marquee-select/marqueeMath.ts (bandRect, hitTest over MarqueeMode, hitIds, resolveSelection over the modifier vocab, modifierFromEvent, passedThreshold) into a shared region-select geometry module with a shape-dispatched hit-test, and re-point the #1406 marquee-select block as the rect member declaring shape: rect against the #1742 intent contract. The non-rect members consume this module's shared helpers. Blocked by #1742 (declares against the intent dimension values). Demoable + regression-safe: marquee-select behaves identically (rect via the new module). First FUI slice; unlocks C+D.

## Progress

Done (resolved 2026-06-26). Re-homed the rect-only geometry into a shared, shape-dispatched kernel; marquee-select is now the rect member, regression-safe.

- `fui:blocks/region-select/regionGeometry.ts` — the shared kernel. Types (`Rect`, `Point`, `RegionShape` rect|lasso|polygon|nearest, `HitMode`, `SelectionModifier`, a discriminated `Region`); rect helpers (`bandRect`, `rectHitTest`); the non-rect helpers slices C+D consume (`pointInPolygon` ray-cast, `polygonHitTest` over intersect/contain/center, `nearestHit` closest-centroid); shape dispatch (`hitTestRegion`, `regionHitIds` — `nearest` is a set-level pick); shape-agnostic `resolveSelection`/`modifierFromEvent`/`passedThreshold`.
- `fui:blocks/marquee-select/marqueeMath.ts` — now a thin re-export of the rect helpers (exact public surface preserved: `bandRect`/`hitTest`/`hitIds`/`resolveSelection`/`modifierFromEvent`/`passedThreshold` + `Rect`/`MarqueeMode`/`MarqueeModifier`). `hitTest`/`hitIds` are the rect facade over `rectHitTest`/`regionHitIds`. **`fui:blocks/marquee-select/MarqueeSelect.ts` + `fui:blocks/marquee-select/index.ts` unchanged; the existing 11 marquee tests pass untouched (regression-safe).**
- `fui:src/_data/blocks.json` — marquee-select declares `implementsIntent: region-select` + `intentDimensions: { shape: rect, mode: intersect, modifier: replace }` (the #1406 rect member against the #1742 contract, mirroring `we:src/_data/blocks/router.json`'s pattern); added a `region-select` Module family entry for the kernel dir (#784 completeness), allowlisted in `fui:scripts/check-standards.mjs` DEMO_PENDING (a pure geometry Module; rect demoed via marquee-select-demo, lasso/polygon/nearest demos land with C+D).
- `fui:blocks/__tests__/unit/region-select/regionGeometry.test.ts` — 10 vectors (rect parity, point-in-polygon incl. a concave L-shape, polygon mode dispatch, nearest, region dispatch, the nearest-throws guard). 21/21 green with the marquee regression suite.

FUI gate: my changeset clears (the repo's 34 pre-existing errors are unrelated upgrader/resource-loader debt — none names my changeset). Unlocks slices C+D (lasso/polygon/nearest members over the shared kernel).
