---
type: issue
workItem: story
size: 3
parent: "170"
status: resolved
dateOpened: "2026-06-12"
blockedBy: ["447"]
dateStarted: "2026-06-13"
dateResolved: "2026-06-13"
tags: []
---

# Bring trait-manifest lazy-loading into Web Everything's bootstrap, build-portably

Move traitManifest.ts (+ virtual-trait-manifest.d.ts) up into WE/plugs and wire bootstrap.ts registerTraits(virtual:trait-manifest) using FU's 3-way resolution (real manifest under Vite trait-enforcer, ambient stub under tsc, empty alias under vitest). Makes WE's bootstrap the superset including #116. Build-portability is wiring, not a fork. Second half of #170's merge-up.

**Dependency correction (2026-06-12):** originally tagged "independent of #447", but `registerTraits` calls `attributes.defineLazy()` / `attributes.preload()`, which only exist on WE's `CustomAttributeRegistry` *after* #447 adopts FU's registry (the lazy fetch-on-view API). So this is `blockedBy #447`. WE also has no trait-enforcer tool, so the "real manifest under Vite trait-enforcer" leg degrades to an empty-manifest alias until the Enforcer is ported (a further #170 follow-on); the manifest ships empty, so that's behaviourally identical today.

## Progress (2026-06-13) — resolved

Ported `plugs/webbehaviors/traitManifest.ts` (The Map + `registerTraits`, delivery dimension incl. eager / lazy-preload #202) and the ambient `plugs/virtual-trait-manifest.d.ts` from FU verbatim — WE's `CustomAttributeRegistry` already has `defineLazy`/`preload` post-#447, so they compile unchanged. Wired [bootstrap.ts](../plugs/bootstrap.ts): static `import { traitManifest } from 'virtual:trait-manifest'` + `registerTraits(window.attributes, traitManifest)` after the last `register*`, before first `upgrade()`. 3-way resolution: ambient `.d.ts` under tsc, and a `resolve.alias` → `/plugs/webbehaviors/traitManifest` (the empty static manifest) in **both** [vite.config.mts](../vite.config.mts) and [vitest.config.ts](../vitest.config.ts) — WE has no Enforcer yet, so the "real manifest under Vite" leg lands on the empty alias too (no-op today; wiring is the deliverable). Ported the 14-case `traitManifest.test.ts` (all green). Gate: tests pass, `check:standards` 0 errors, no new tsc errors. **The Enforcer port (real chunk generation) → spun off as #484** (the `#170` follow-on the body anticipated).
