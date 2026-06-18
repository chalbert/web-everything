---
type: issue
workItem: story
size: 13
status: open
parent: "746"
relatedProject: webdocs
blockedBy: ["753"]
dateOpened: "2026-06-16"
tags: [webdocs, adapters, polyglot, generation, component-emit]
---

# Author-mode emit — start on the declarative `<component>` subset (bidir transform); dedicated emit IR (C) deferred (#811 Fork 2)

Author mode for the polyglot panel (#753): emit idiomatic native React/Vue/Svelte/Angular component source — the browser member of the ratified #463 forward-generation family (#506-gated). Per #811's ruling, **start subset-first, not with a new IR**, and treat the dedicated emit IR (Option C) as a deferred, case-informed follow-on. **DEMAND-GATED**: build only after #753's consume-mode (CEM-wrapper) probe ships and appetite for idiomatic source is shown; consume mode needs no IR.

## Approach (per #811 Fork 2)

Constrain to the subset that already round-trips through the WE declarative `<component>` form (`ComponentIR` → `generateComponentSource`, [we:upgraderEngine.ts:135](../blocks/renderers/upgrader/upgraderEngine.ts#L135)) and emit per-framework from it ("flag, don't fake" outside the subset). The known wall (flat declarative under-specifies Vue/Svelte/Angular binding idioms) is the signal + case evidence to later design the dedicated emit-purpose IR (Option C, a neutral `@webeverything` contract) — delayed as long as possible so C is informed, not guessed.

## Phasing

1. **Subset-first emit** (this item's near-term scope, once demand-gated): per-framework serialization from the existing declarative-`<component>` round-trip subset.
2. **Dedicated emit IR (C)** — a *later, separately-filed* design call, made with the accumulated cases from phase 1; not in scope here until the subset demonstrably stops stretching.
