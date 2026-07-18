---
kind: story
size: 5
parent: "xpex0n8"
status: open
locus: frontierui
dateOpened: "2026-07-18"
tags:
  - frontier-ui
  - semantic-zoom
  - implementation
  - console-board
crossRef: { url: /intents/semantic-zoom/, label: semantic-zoom intent }
relatedProject: webblocks
---

# FUI block for the semantic-zoom intent

The `semantic-zoom` intent ([#2536](/backlog/2536-mint-the-semantic-zoom-level-of-detail-intent.md), `we:src/_data/intents/semantic-zoom.json`) is spec-only. Build the Frontier UI block that `implementsIntent: semantic-zoom`.

**Scope:**
- A **level axis** selecting among distinct representations of the same data (chip → card-with-bar → expanded-panel-with-checklist) — each level a different representation, not a scaled view.
- The dimensions: `trigger` (zoom/viewport/explicit), `transition` (snap/crossfade), `levels` (binary/graded).
- **Fixed mechanic (non-negotiable):** the focused datum (or pinch centroid) stays anchored across a level swap — a user never loses their place — plus keyboard parity, with each `levelchange` announced to assistive tech.

**Composition:** compose `viewport-transform` (`we:src/_data/intents/viewport-transform.json`) when a surface also pans/zooms geometrically, and `gesture` for pinch/Ctrl+scroll recognition. Do NOT fold geometric zoom into this block — they are separate contracts (the exact conflation #2533 Fork 3 ruled against).

**Acceptance:** a block in `fui:blocks.json` with `implementsIntent: semantic-zoom`, its `fui:` block-description, and a demo that swaps representations across levels in a real browser; passes the render-conformance loop.
