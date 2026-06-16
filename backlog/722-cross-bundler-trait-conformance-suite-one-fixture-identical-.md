---
type: issue
workItem: story
size: 8
parent: "715"
status: resolved
blockedBy: ["716", "717", "744"]
dateOpened: "2026-06-15"
dateStarted: "2026-06-16"
dateResolved: "2026-06-16"
graduatedTo: tools/trait-enforcer/__tests__/cross-bundler-conformance.test.ts
tags: []
---

# Cross-bundler trait conformance suite — one fixture, identical manifest + chunk isolation everywhere

A conformance suite that runs one fixture (a component binding a lazy trait, an eager trait, and a preload trait) through every supported bundler (Vite, Rollup, webpack, esbuild, Parcel) and asserts they emit an identical manifest AND identical chunk isolation — an unused trait produces zero chunk under each. Mirrors the proven patterns next door: #234's 4-bundler marker test, #238's real webpack build, #506's MaaS golden vectors. This is what makes 'tree-shakable everywhere' a verified property rather than a per-bundler hope. Blocked on the #716 contract (the golden manifest) and #717 (the baseline implementations to test).

## Resolved (2026-06-16) — 4 of 5 bundlers; Parcel row owned by #756

`tools/trait-enforcer/__tests__/cross-bundler-conformance.test.ts`. One shared fixture (a lazy + an
eager + a preload trait, plus an **unused** trait), two conformance claims:

- **Part A — manifest byte-identity.** Each adapter is shown to serve the *exact* output of the one
  shared `buildTraitManifestSource` core, proven by invoking each adapter's load mechanism directly
  (Vite/Rollup `load` hook, esbuild `onLoad`, webpack `beforeResolve` → data: URI) — no full build needed.
- **Part B — identical chunk isolation.** A REAL production build per bundler asserts the same topology
  via unique per-trait markers: the eager trait inlined into the entry, the lazy + preload traits each
  code-split into their own chunk, the unused trait producing **zero bytes** (tree-shaken from the
  manifest). Rollup, esbuild, webpack run genuine builds; Vite is driven through Rollup (its production
  bundler) since the Vite adapter is a Rollup-shaped plugin and a bare-virtual-entry `vite.build` needs an
  html/lib entry + re-poisons the shared esbuild service.

**Parcel is the one pending leg** — its adapter surfaced a design fork in #744 and is carved to **#756**.
The suite is written to extend, so #756's definition of done includes adding the Parcel row here. Scope
honestly recorded: this verifies 4 of the 5 named bundlers; Parcel completes the matrix when #756 lands.
