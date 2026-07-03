---
kind: story
size: 5
parent: "2093"
status: resolved
blockedBy: ["2104", "1989"]
dateOpened: "2026-07-02"
dateStarted: "2026-07-03"
dateResolved: "2026-07-03"
tags: []
---

# Add the region inert recipe ({#…}{/…} nesting stack → template host)

Add delimiter-keyed region parsing for children:'inert' ({#each items}…{/each}): regionName/regionClose name-echo matching + the nesting match-stack (#2074 Risk 2), materialized onto <template> via the transform path (fui:blocks/view/ViewIfDirective.ts:147-163, fui:plugs/webdirectives/CustomTemplateType.ts:42-68). Boundary markers follow the standard authored open-close grammar per #1989's ruling (one grammar, no separate residue sigil; idempotent under re-claim); coordinate with active #2068.

**Resolved (#2110).** Built the region mechanism in the #2074 `customNodes` polyfill (WE holds zero impl, #6 — the standard was already codified at we:docs/agent/block-standard.md#custom-node-recipes; this is the FUI build only):

- `fui:plugs/webnodes/recipes/RegionNode.ts` — the `children:'inert'` region recipe base (`extends CustomNode`, so it is registrable + `instanceof CustomNode`). Its rendered host is a separate `<template>` (the platform's only inert container), assigned to `this.host` by the region walk before `upgrade()` — the Text extension `CustomNode` carries for the value:'shown' first consumer is a polyfill artifact, not the region's host (the firewall: host is a polyfill outcome, never authored).
- `fui:plugs/webnodes/recipes/regionRecipes.ts` — the concrete `EachRegionNode` (`{#each items}…{/each}`), the canonical #2074 example (open `{#`, close `}`, regionName `each`, regionClose `{/each}`).
- `fui:plugs/webnodes/CustomNodeRegistry.ts` — the region walk `upgradeRegions(root)`. The load-bearing part is the **name-echo match-stack** (#2074 Risk 2): open and its name-echoed close are paired by balancing a per-recipe depth counter across sibling text nodes, so a nested `{#each}` pushes and its `{/each}` pops — only the balanced *outer* close terminates the outer region. Nested regions materialize recursively into the parked `.content`. Regions run BEFORE the value:'shown' text walk, so a body's `{{ }}` interpolation stays inert in `.content` (not top-level-rendered). Name-prefix false matches (`{#eachother}`) and unbalanced source (missing close) are skipped, not mis-carved.

Mechanism only — the per-item stamping consumer and the bundle grammars (#2094 B1–B5, which are `blockedBy 2110`) build on this. FUI `check:standards` green; 10 new unit tests at fui:plugs/webnodes/__tests__/unit/RegionNode.test.ts (nesting balance, name-echo boundary, unbalanced-skip, inert-body, multiple siblings, host/params seeding). Not migrated onto the existing view directives (`ViewIfDirective`/`ForEach`) — those are the separate migration slices; this adds the region grammar the standard's nature table names.
