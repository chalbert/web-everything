---
type: issue
workItem: story
size: 2
parent: "170"
status: resolved
locus: plateau-app
blockedBy: ["1045"]
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "plateau:vite.config.mts"
tags: [plugs, dedup, migration, plateau-app]
---

# Repoint plateau-app from @we/plugs to @frontierui/plugs

Retarget plateau-app's plugs alias from WE to the `@frontierui/plugs` package: `plateau-app:tsconfig.json:16` (`@we/plugs/*` → `../webeverything/plugs/*`), `plateau-app:vite.config.mts:120` (`@we/plugs` → `weRoot/plugs`) and `plateau-app:vite.config.mts:126` (`virtual:trait-manifest` → `weRoot/plugs/webbehaviors/traitManifest`). Independent repo (own :4000 dev server). plateau-app build green; no `@we/plugs/*` reference survives. Sibling of #449 under the #170 plugs-dedup epic; blocked only by the package landing (#1045).

## Dropped from batch-2026-06-19 (live dev-server verified)

Not batchable for the same reason as sibling #449. Verified plateau-app's Vite dev server **live on :4000**
(PID 1669) at claim time; this item's core edits are `plateau-app:vite.config.mts:120,126` (the
`@we/plugs` / `virtual:trait-manifest` alias retarget), which force-restart that running server — forbidden
by the dev-server instruction ("leave servers as you found them"). No safe partial: the alias must update at
the Vite runtime level for plateau-app's `@we/plugs/*` imports to resolve, so a tsconfig-only pass leaves
the app broken at runtime. Resume in a dedicated `/next 1046` session where the :4000 server can be
restarted. Blocker #1045 resolved — readiness is purely the toolchain-restart constraint.

## Resolution (2026-06-19, parallel batch serial lane)

Repointed all of plateau-app's `@we/plugs` references to `@frontierui/plugs` (FUI owns the plugs impl;
plateau-app consumes it as a no-leakage client per #606/#449), mirroring the WE-side sibling pattern:

- `plateau:tsconfig.json` — `@we/plugs/*` paths → `@frontierui/plugs` (bare → `fui:plugs/index.ts`) + `@frontierui/plugs/*` (subpath), both → the sibling `fui:plugs/` dir.
- `plateau:vite.config.mts` — added `fuiPlugsRoot` const; alias `@we/plugs` → `@frontierui/plugs` = `fuiPlugsRoot`; `virtual:trait-manifest` → `fuiPlugsRoot/webbehaviors/traitManifest`; the bootstrap HTML-injection plugin now imports/detects `@frontierui/plugs/bootstrap`.
- `plateau:vitest.config.ts` — same alias retarget so unit tests resolve plugs identically to dev.
- `plateau:src/main.ts` — `import '@we/plugs/bootstrap'` → `import '@frontierui/plugs/bootstrap'`.

No `@we/plugs` reference survives. Verified: 251/251 plateau-app unit tests pass through the new alias
(exercises plugs resolution transitively); the dev :4000 server was never touched (work done via
build/test commands). NOTE: `vite build` fails on a PRE-EXISTING, unrelated missing artifact —
`plateau:src/intent-configurator/configurator.ts` imports `we:src/_data/intents.json` (via a relative path),
an Eleventy-generated `_data` file absent from this WE checkout. Confirmed identical failure on pristine
HEAD (fails before plugs is ever resolved), so it is not introduced by this change; tracked separately.
