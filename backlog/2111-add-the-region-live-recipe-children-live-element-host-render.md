---
kind: story
size: 3
parent: "2093"
status: resolved
blockedBy: ["2110"]
dateOpened: "2026-07-02"
dateStarted: "2026-07-03"
dateResolved: "2026-07-03"
tags: []
---

# Add the region live recipe (children:'live' → element host, rendered in place)

Add the children:'live' region recipe ({#ctx theme="dark"}…{/ctx} — rendered in place, element host) sharing the #2110 region stack; context-provider fixture (zero render effect) + tests.

**Resolved (#2111).** Built the `children:'live'` live-region recipe and walk in FUI (WE holds zero impl — the standard's nature table was already codified at we:docs/agent/block-standard.md#custom-node-recipes):

- `fui:plugs/webnodes/recipes/LiveRegionNode.ts` — the `children:'live'` region recipe base (`extends CustomNode`). Mirrors `RegionNode` (`children:'inert'`) but the host is a live **element** (default `<span>`, overridable via `static tag`) rather than `<template>`. Body renders in place; `this.host` is the element host seeded by the walk. The polyfill firewall holds: element-tag selection is a polyfill detail, not a standard promise.
- `fui:plugs/webnodes/recipes/liveRegionRecipes.ts` — the concrete `CtxRegionNode` (`{#ctx theme="dark"}…{/ctx}`), the canonical `children:'live'` example. Zero render effect by default (no `upgrade()` body) — the context-provider fixture proving the grammar + host with no tree mutation of its own.
- `fui:plugs/webnodes/CustomNodeRegistry.ts` — three changes:
  1. **Composite dispatch key** (`open\x00regionName`) for region recipes per #2112 rule 7: `{#each}` and `{#ctx}` share `open='{#'` but have different `regionName`, so they co-exist without `DelimiterCollisionError`. Value/marker recipes keep the plain `open` key.
  2. **`#liveRegionRecipes()` + `upgradeLiveRegions(root)`** — the live-region walk: same name-echo match-stack as `upgradeRegions` but wraps the body in an element host (moved live, not parked in `.content`). Called from `upgrade()` after the inert-region pass, before hidden-computes.
  3. **`getRegion(open, regionName)`** — public accessor for region recipes via composite key (the `get(open)` shorthand now only covers value/marker recipes).
- `fui:plugs/webnodes/__tests__/unit/RegionNode.test.ts` — updated to use `registry.getRegion('{#', 'each')` (the composite key) in the define/lookup assertion.
- `fui:plugs/webnodes/__tests__/unit/LiveRegionNode.test.ts` — 14 new unit tests: identity, co-existence with `EachRegionNode`, element-host materialization, param seeding, tag override, static siblings, multiple siblings, unbalanced-skip, live-body vs inert distinction, node-identity (move not clone), context-provider fixture zero-effect.
