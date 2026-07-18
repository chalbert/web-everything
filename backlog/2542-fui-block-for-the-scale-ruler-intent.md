---
bornAs: xuxotu6
kind: story
size: 5
parent: "2541"
status: open
locus: frontierui
dateOpened: "2026-07-18"
tags:
  - frontier-ui
  - scale-ruler
  - implementation
  - console-board
crossRef: { url: /intents/scale-ruler/, label: scale-ruler intent }
relatedProject: webblocks
---

# FUI block for the scale-ruler intent

The `scale-ruler` intent ([#2534](/backlog/2534-mint-the-scale-ruler-foundational-scale-primitive.md), `we:src/_data/intents/scale-ruler.json`) is spec-only. Build the Frontier UI block that `implementsIntent: scale-ruler` so the `intent → block` chain has a runnable home.

**Scope:**
- The scalar→length|position map on a labeled axis in real units (`{ scalar, unit, pxPer, cap?, axisRef }`), across the `type` (linear/log/time/band) × `orientation` (horizontal/vertical) dimensions.
- The `aggregate` (none/sum/extent) over a stack sharing one `axisRef` (stacked card heights → a lane ETA).
- The `reference` marks (tick / region) — a datum/threshold guide on the axis.
- **Native-first:** build over `<progress>` (scalar→length) and CSS `aspect-ratio` (ratio→box); do not reinvent below the platform floor.

**Boundary:** the WE contract owns the semantic marking of a reference value/region; the **region-mask visual treatment** (e.g. `backdrop-filter: grayscale` on the crossed side) is FUI-owned presentation — it lands in this block, NOT back in WE.

**Acceptance:** a block registered in `fui:blocks.json` with `implementsIntent: scale-ruler`, its `fui:` block-description, and a demo exercising the contract in a real browser; passes the render-conformance loop. Web Charts composes this scale as its positional substrate.
