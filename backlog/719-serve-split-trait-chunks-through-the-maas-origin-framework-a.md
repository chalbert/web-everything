---
kind: story
size: 5
parent: "715"
status: resolved
blockedBy: ["716", "461"]
dateOpened: "2026-06-15"
dateStarted: "2026-06-16"
dateResolved: "2026-06-16"
graduatedTo: blocks/renderers/module-service/traitServePath.ts
tags: []
---

# Serve split trait chunks through the MaaS origin (framework-agnostic fetch)

Wire the code-split trait chunks through the #461 MaaS distribution origin so the split traits are fetchable framework-agnostically — a non-Vite/non-bundler consumer pulls only the traits a component binds, over HTTP. Reuse the substrate already built: #461's Fetch origin, #462's eager hot-set / lazy-default distribution policy, and #505's serve-path IR (or a trait-specific extension of it). Today the MaaS origin serves <component> module artifacts, not trait chunks — this is the integration that brings traits onto the served path. Blocked on the #716 neutral contract (so served manifests match built ones) and on #461 (the origin).

## Progress

Brought traits onto the served path by reusing the substrate (no IR fork):

- Added [we:traitServePath.ts](../blocks/renderers/module-service/traitServePath.ts) — the framework-agnostic integration:
  - `traitServePath(trait, {basePath, pin})` builds the MaaS URL by filling the **same** #505 `SERVE_PATH.route` (`<name>[@<pin>].js`) a component artifact uses — a trait is just another `<name>` artifact, so the wire shape is unchanged.
  - `planTraitDistribution(manifest, {pins})` turns a #716 `TraitManifest` (scoped to the traits a component binds) into the #462 policy on the served path: **eager → inlined** (never fetched), **lazy → fetched on first use**, **lazy+preload → warmed at bootstrap**. Each fetched chunk carries its #505 `Cache-Control` (pinned → immutable, unpinned → floating). Deterministic ascending-lexicographic order, so the plan matches the built manifest byte-for-byte.
- Tests [we:traitServePath.test.ts](../blocks/__tests__/unit/renderers/traitServePath.test.ts) — 7/7 green (path build incl. pin/base-path, eager-inline vs lazy vs preload bucketing, immutable/floating cache, determinism).

**Remaining build seam → scaffolded #743:** the MaaS `DefinitionResolver` still only resolves component `<name>` artifacts, so a `GET /_maas/<trait>.js` 404s until the resolver unions trait module definitions. That is a pure build-wiring follow-up (no design fork); the neutral served-path contract + distribution plan this item is about is complete and tested.
