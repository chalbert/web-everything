---
kind: story
size: 3
parent: "1384"
status: resolved
blockedBy: []
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: "we:src/_data/intents/resizable.json"
tags: []
---

# resizable (splitter) intent spec — mint we:src/_data/intents/resizable.json (role=separator divider, min/max, orientation, collapse-to-edge); layout.pane composes it

Fork 1 of #1384: a standalone resizable splitter intent (linear-split divider) that any block + layout.pane compose. APG Window Splitter a11y (role=separator + aria-valuenow/min/max + arrows/Home/End), Pointer Events substrate. Build deferred from the spatial-manipulation placement ruling.

## Progress

- Minted we:src/_data/intents/resizable.json (+ glossary we:src/_data/semantics/resizable.json);
  auto-renders at /intents/resizable/ via we:src/intent-pages.njk. `status: concept` (no impl yet).
- Dimensions: `orientation` (vertical/horizontal), `unit` (percent default/pixel), `collapse`
  (none default/edge). Per-pane min/max are numeric binding properties (not an enum), feeding
  aria-valuemin/max. APG Window Splitter a11y authored as a FIXED invariant in prose (role=separator,
  aria-valuenow/min/max, arrow/Home/End/Enter), not a dimension.
- Composes layout.pane; pan-drag recognized via the gesture intent (resizable is the effect). Cleared
  the stale `blockedBy: ["1384"]` edge (#1384 resolved).
