---
type: decision
workItem: story
size: 3
status: open
dateOpened: "2026-06-18"
tags: []
---

# Decide exactly what of WE's trait-enforcer moves to FUI vs stays, given WE consumers + partial FUI copy (#894 surgery)

#894 pre-flight (batch-2026-06-17) found its premises only partly true. (1) FUI does NOT already hold the whole enforcer — frontierui/tools/trait-enforcer/ has only vite-plugin.ts + virtual.d.ts, NOT traitManifestContract.ts, the rollup/webpack/esbuild/parcel plugins, or composedTraitSet.ts; a move must ADD those to FUI, not delete a dup. (2) WE genuinely consumes the pieces #894 says to move: blocks/renderers/module-service/traitServePath.ts imports traitManifestContract TYPES (the MaaS serve-path); plugs/bootstrap.ts + tools/maas/vite-plugin.ts consume virtual:trait-manifest provided by the vite.config.mts:96 traitEnforcer plugin. (3) The item itself flags an open residual: whether even the Web Traits protocol surface (trait attr + registerTraits + CustomAttributeRegistry, which live in plugs/webbehaviors/, NOT in tools/trait-enforcer/) is wholly FUI (~70% it stays WE). Decide: (A) move only the 5 bundler plugins + composedTraitSet to FUI, KEEP traitManifestContract in WE (traitServePath consumes its types) + KEEP the protocol surface in WE, and swap vite.config's virtual:trait-manifest from the plugin to the empty resolve.alias the vitest leg already uses (mechanical, bootstrap still resolves) — lean A ~70%; (B) move traitManifestContract too and re-home/rewire traitServePath (bigger, couples to the MaaS serve-path's own locus); (C) move the protocol surface as well (the ~30% branch). Reconsiders the #894/#779 framing. Blocks #894.
