---
kind: story
size: 5
parent: "142"
status: resolved
locus: plateau-app
dateOpened: "2026-06-23"
dateStarted: "2026-06-23"
dateResolved: "2026-06-23"
graduatedTo: "plateau:src/dev-browser/variant-simulator/"
tags: []
---

# Variant simulator for locale, flag, role, viewport, motion (dev browser)

Build the dev-browser variant simulator (#1643, ratified go): drive the running app through declared variant axes — locale, feature flag, role, viewport, reduced-motion — and render each variant live from the app's own declared variant model. Home plateau:dev-browser.

## Progress (resolved 2026-06-23, batch-2026-06-23-1689-1500)

Built as `plateau:src/dev-browser/variant-simulator/`:

- **`plateau:src/dev-browser/variant-simulator/types.ts`** — `VariantAxisId` (the 5 declared axes:
  locale/flag/role/viewport/motion), `VariantAxis` (id + declared `values`), `VariantModel` (the app's own
  declared model), `VariantSelection`, `Variant`, and the single app seam `VariantApplier`
  (`apply(selection)` + optional `reset()`) — the simulator is generic over it (the app knows how to set its
  own locale/role/viewport/etc.).
- **`plateau:src/dev-browser/variant-simulator/simulate.ts`** — `enumerateVariants(model, mode)`:
  **per-axis** (baseline + one variant per non-baseline value — the manageable default) or **product** (full
  cartesian, opt-in, since 5 axes explode); `simulateVariant`/`simulateVariants` drive each through the
  applier in order, resetting between, **capturing errors as `ok:false`** (never throws); `variantLabel` for
  a stable axis-ordered label.
- **`plateau:src/dev-browser/variant-simulator/variant-simulator.test.ts`** — 7 tests (per-axis +
  product enumeration, empty model, ordered driving with reset, error capture, async applier).

The model + applier are the app's; the simulator owns *which* variants and the order. The axes wire to the
declared models elsewhere in the constellation (role → the webpermissions contract #1699; motion →
webintents `data-intent-motion` #1657). Home plateau dev-browser. Plateau suite green (the one red is the
pre-existing external `render-conformance` baseline staleness, not this module).
