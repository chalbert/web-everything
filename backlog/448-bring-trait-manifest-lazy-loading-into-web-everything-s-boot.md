---
type: issue
workItem: story
size: 3
parent: "170"
status: open
dateOpened: "2026-06-12"
blockedBy: ["447"]
tags: []
---

# Bring trait-manifest lazy-loading into Web Everything's bootstrap, build-portably

Move traitManifest.ts (+ virtual-trait-manifest.d.ts) up into WE/plugs and wire bootstrap.ts registerTraits(virtual:trait-manifest) using FU's 3-way resolution (real manifest under Vite trait-enforcer, ambient stub under tsc, empty alias under vitest). Makes WE's bootstrap the superset including #116. Build-portability is wiring, not a fork. Second half of #170's merge-up.

**Dependency correction (2026-06-12):** originally tagged "independent of #447", but `registerTraits` calls `attributes.defineLazy()` / `attributes.preload()`, which only exist on WE's `CustomAttributeRegistry` *after* #447 adopts FU's registry (the lazy fetch-on-view API). So this is `blockedBy #447`. WE also has no trait-enforcer tool, so the "real manifest under Vite trait-enforcer" leg degrades to an empty-manifest alias until the Enforcer is ported (a further #170 follow-on); the manifest ships empty, so that's behaviourally identical today.
