---
kind: story
size: 13
status: open
blockedBy: ["1830"]
dateOpened: "2026-06-27"
dateStarted: "2026-06-27"
tags: []
---

# Implement the custom-states plug in FUI (plugged validation+polyfill, unplugged sugar, component lowering)

Governed by the #1807 ruling; blocked on the WE plug-contract mint (#1830). Implement the custom-states plug runtime in Frontier UI: the unplugged form (a non-invasive setter/getter over native CustomStateSet, no enforcement — the product surface) and the plugged form (validation system rejecting un-declared toggles + a polyfill for the declaration/validation layer). Wire the declarative <component> lowering so states= lowers to the per-instance constructor-time declaration call (mirroring default-aria-*), wiring BOTH the emitted class and the runtime twin (fui:blocks/renderers/component/declarativeComponent.ts defineFromDefinition currently drops defaultAria — the twin-lag noted in #1807/#853). This is also where #1794's CustomStateSet adoption lands.

## Pre-flight (batch-2026-06-27-1842-1720) — outgrew size 5 → re-sized 13; needs /slice before batching

Grounded against the minted contract (`we:src/_data/plugs/customstates.json`) + the FUI tree. The item bundles
**six distinct subsystems**, not a size-5 story — the contract itself enumerates three mechanisms (declaration,
validation, polyfill) over a two-mode (plugged/unplugged) delivery axis. Concretely:
1. **`states="…"` parse + `ComponentDef.states`** — mirrors the `default-aria-*` parse in
   `fui:blocks/renderers/component/declarativeComponent.ts`.
2. **The twin-lag fix** — `generateClassSource` applies `defaultAria` in the emitted constructor
   (`fui:blocks/renderers/component/declarativeComponent.ts` line 177) but the runtime twin
   `defineFromDefinition` **drops it** (line 217: `wantsInternals = formAssociated || !!defaultRole`, no
   `defaultAria`/`states`). Self-contained, valuable.
3. **Plugged validation** — reject/warn an un-declared `internals.states` toggle. This is **NOT** a simple
   property-set like `default-aria`: it needs a **net-new runtime plug hook** (`declareStates(internals, vocab)`
   resolved from the plug context — plugged = a validating `CustomStateSet` wrapper; unplugged = passthrough).
4. **The polyfill** of the nowhere-native declaration+validation layer (plugged mode).
5. **The unplugged setter/getter floor** over native `CustomStateSet` (no enforcement).
6. **#1794's CustomStateSet adoption** lands here too.

Each of (3)/(4) is itself real plug-architecture work. **Re-sized 5 → 13 and released `active → open`** — it is
**not batchable** as one story. **/slice it** into at least: **(A)** `states=` parse + lowering + the twin-lag
fix + the unplugged floor [a clean batchable slice mirroring `default-aria`]; **(B)** the plugged validation
+ polyfill + the `declareStates` plug-hook architecture [needs its own design pass]; **(C)** #1794 adoption.
The size-5 estimate predated reading the contract's three-mechanism shape.
