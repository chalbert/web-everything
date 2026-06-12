---
type: idea
workItem: story
size: 5
status: parked
dateOpened: "2026-06-11"
tags:
  - base-select
  - droplist
  - native-first
  - implementation
---

# base-select-backed droplist implementation

Build the base-select-backed droplist component: a Web Component wrapper that adopts native customizable `<select>` (`appearance: base-select`), plugs the droplist intents/traits onto it, and handles form-association, a11y, and graceful degradation to a plain styled `<select>` where unsupported. This is the missing *implementation* counterpart to the FACE-backed impl that `frontierui/blocks/droplist/*` already provides — base-select is registered as a resolver impl (`capabilityMatrix.json`) but has no built component. Ruled out of #020 as an implementation (not a standard). PARKED: gated on `appearance: base-select` shipping in a second engine (currently Chromium-only, not polyfillable); productionizing earlier buys little since the resolver already degrades base-select→face per-browser.
