---
type: issue
workItem: story
size: 2
parent: "170"
status: open
locus: plateau-app
blockedBy: ["1045"]
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
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
