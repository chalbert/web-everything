---
kind: story
size: 5
status: resolved
locus: plateau-app
dateOpened: "2026-06-23"
dateStarted: "2026-06-26"
dateResolved: "2026-06-26"
graduatedTo: 099
tags: []
---

# Unified project-config discovery view (derived, non-authoritative aggregator)

Build the optional discovery view ratified by #1662: a plateau-app-locus aggregator/resolver that READS the per-dimension resolved configs and shows the whole project config at one glance (project identity / one-stop discovery). Strictly non-authoritative — never written to, never a second source of truth; the per-dimension keys/files remain the SoT. Dev-oriented (strippable from production). A Technical-Configurator-adjacent surface. Depends on the loader from #1702.

## Progress (batch-2026-06-26-1745-1775)

Built the discovery view as a plateau-app dev surface that consumes the #1702 config machinery across the
constellation: the resolver runtime from FUI (`@frontierui/config`, relocated #1780) + the contract from WE
(`@webeverything/config`). Strictly non-authoritative (read-only, no cross-dimension merge — #1662 step 5).
- `plateau:src/project-config-discovery/discovery.ts` — pure `summarizeConfig(config, resolvers)` read-model
  (each dimension resolved independently; extends-chain / inline / pointer / absent classified) + the
  `mountProjectConfigDiscovery` surface (a non-authoritative table). `PLATFORM_RESOLVERS` wires the FUI
  flavor factories; `SAMPLE_CONFIG` demonstrates over a representative config.
- `plateau:src/project-config-discovery/discovery.test.ts` — 7 tests on the read-model (independence,
  nearest-wins, pointer=error, absent=platform-default).
- `plateau:src/main.ts` + `plateau:index.html` — route + nav + mount wiring (mirrors technical-configurator).
- `plateau:vite.config.mts` / `plateau:tsconfig.json` / `plateau:vitest.config.ts` — added `@frontierui/config`
  + `@webeverything/config` aliases (and `@core` — FUI's autoDefine resolver pulls the registry kernel via
  FUI's internal `@core` alias; mirrored in lockstep).
- `plateau:scripts/render-conformance-baseline.json` — re-baselined to lock in the new surface (#1280 gate).

Contract nuance surfaced + modeled: a bare-string entry is a `DimensionPointer` (extract-to-file), not an
inline value — shown as a "needs the loader" row until #1702's loader substitutes it (a documented follow-on).

Gate: plateau-app `vitest run` 563 pass (was failing only on the new-surface baseline, now updated); tsc
clean for the new module (the one pre-existing `@we/blocks/stores/...` error is unrelated/baseline).
