---
kind: story
size: 8
status: open
dateOpened: "2026-07-18"
tags:
  - standards
  - ui-primitives
  - scale-ruler
  - web-charts
  - console-board
---

# Mint the `scale-ruler` foundational scale primitive

Graduated from decision [#2533](/backlog/2533-console-board-derived-ui-standards.md) (Fork 1, with Fork 4 folded in). Ratified under the corrected minting bar: prior-art research establishing a fundamental, recurring, web-platform-aligned pattern is sufficient to justify a standard.

Mint a **foundational scale primitive** — the scalar→position/length axis that sits *below* charts, layout, and animation, the way `d3-scale` is a standalone package precisely because scales are reused everywhere. Contract shape:

- **Core map:** `{ scalar, unit, pxPer, cap?, axisRef } → length | position + aggregate`. Map a scalar value to a length or a position on a labeled axis, in real units, and aggregate a stack of scalars (e.g. stacked card heights → a lane ETA).
- **Reference-line / tick feature (Fork 4 folded in):** a datum/threshold line is a *reference mark on the scale* — a guide, exactly as a Photoshop/Figma guide belongs to the ruler, not to a separate tool. This is what `d3-axis` reference rules and Vega's `rule` mark draw. Bake the "mark this value / region on the axis" semantic into the scale as a reference-line feature. The region-mask presentation (e.g. desaturating the "past" side with `backdrop-filter`) is **FUI presentation**, NOT part of the WE contract.
- **Native-first baseline:** the thin native primitives this leans on are `<progress>` (a scalar rendered as a length) and CSS `aspect-ratio` (a ratio mapped to a box). Extend from those; do not reinvent below the platform floor.

**Prior art (the recurring-pattern grounding):** `d3-scale` as a standalone foundational package (scales sit below charts and are reused across layout/animation/color); design-tool **rulers + guides** across Photoshop, Illustrator, Figma, Sketch, and CAD (a persistent labeled axis mapping document position to screen position in units, with guides as snapped reference marks); Vega-Lite positional/`size` encodings as the base grammar.

**Home:** the foundational layer that **Web Charts** (`we:src/_data/projects/webcharts.json`, #105) composes above. The scale extracts as its own primitive; Web Charts' marks sit on top of it. "It's Web Charts minus the marks" argues *for* extracting the scale as the foundational layer, not against a mint.

**Acceptance:** a new `scale`/`scale-ruler` intent definition lands (definitions only — WE holds zero impl); the contract expresses the scalar→length|position map, the aggregate, and the reference-line/tick feature; the native-first baseline (`<progress>`/`aspect-ratio`) and the FUI-owned region-mask boundary are stated; Web Charts is cited as the composing consumer; the definition passes `check:standards`.
