---
type: issue
workItem: story
size: 2
parent: "170"
status: open
locus: plateau-app
blockedBy: ["1045"]
dateOpened: "2026-06-19"
tags: [plugs, dedup, migration, plateau-app]
---

# Repoint plateau-app from @we/plugs to @frontierui/plugs

Retarget plateau-app's plugs alias from WE to the `@frontierui/plugs` package: `plateau-app:tsconfig.json:16` (`@we/plugs/*` → `../webeverything/plugs/*`), `plateau-app:vite.config.mts:120` (`@we/plugs` → `weRoot/plugs`) and `plateau-app:vite.config.mts:126` (`virtual:trait-manifest` → `weRoot/plugs/webbehaviors/traitManifest`). Independent repo (own :4000 dev server). plateau-app build green; no `@we/plugs/*` reference survives. Sibling of #449 under the #170 plugs-dedup epic; blocked only by the package landing (#1045).
