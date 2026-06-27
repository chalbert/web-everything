---
kind: story
size: 5
status: open
blockedBy: ["1830"]
dateOpened: "2026-06-27"
tags: []
---

# Implement the custom-states plug in FUI (plugged validation+polyfill, unplugged sugar, component lowering)

Governed by the #1807 ruling; blocked on the WE plug-contract mint (#1830). Implement the custom-states plug runtime in Frontier UI: the unplugged form (a non-invasive setter/getter over native CustomStateSet, no enforcement — the product surface) and the plugged form (validation system rejecting un-declared toggles + a polyfill for the declaration/validation layer). Wire the declarative <component> lowering so states= lowers to the per-instance constructor-time declaration call (mirroring default-aria-*), wiring BOTH the emitted class and the runtime twin (fui:blocks/renderers/component/declarativeComponent.ts defineFromDefinition currently drops defaultAria — the twin-lag noted in #1807/#853). This is also where #1794's CustomStateSet adoption lands.
