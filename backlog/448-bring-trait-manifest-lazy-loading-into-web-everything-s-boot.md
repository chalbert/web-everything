---
type: issue
workItem: story
size: 3
parent: "170"
status: open
dateOpened: "2026-06-12"
tags: []
---

# Bring trait-manifest lazy-loading into Web Everything's bootstrap, build-portably

Move traitManifest.ts (+ virtual-trait-manifest.d.ts) up into WE/plugs and wire bootstrap.ts registerTraits(virtual:trait-manifest) using FU's 3-way resolution (real manifest under Vite trait-enforcer, ambient stub under tsc, empty alias under vitest). Makes WE's bootstrap the superset including #116. Build-portability is wiring, not a fork. Second half of #170's merge-up, independent of #447.
