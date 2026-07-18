---
kind: story
size: 8
status: resolved
dateOpened: "2026-07-18"
dateStarted: "2026-07-18"
dateResolved: "2026-07-18"
graduatedTo: "we:src/_data/intents/semantic-zoom.json (Semantic Zoom Intent)"
tags:
  - standards
  - ui-primitives
  - semantic-zoom
  - level-of-detail
  - console-board
---

# Mint the `semantic-zoom` / level-of-detail intent

Graduated from decision [#2533](/backlog/2533-console-board-derived-ui-standards.md) (Fork 3). Ratified under the corrected minting bar: this is a coined, studied, shipped pattern, so prior art alone justifies the mint.

Mint a **representational-zoom (semantic-zoom / level-of-detail)** intent — a zoom where **each level is a different representation of the same data**, not a scaled view of one representation (e.g. a chip → a card-with-bar → an expanded panel-with-checklist). It is genuinely distinct from:

- **`we:src/_data/intents/viewport-transform.json`** — geometric pan/zoom, which explicitly disclaims representation. Do NOT extend `viewport-transform`; that conflates geometric scaling with representational swap.
- **`we:src/_data/intents/hierarchy.json`** — tree traversal / drill-down.
- **`we:src/_data/intents/density.json`** — detail-tier rendering.

The level axis is the intent's own dimension: which representation renders is picked by the current LOD level.

**Prior art (many independent parties — the recurring-pattern grounding):**
- Microsoft's **`SemanticZoom`** control (Windows 8 / UWP) — a *named, shipped UI primitive*: a pinch/Ctrl+scroll switches between a zoomed-out grouped-header view and a zoomed-in item view (two different representations of one data source). The pattern was standardized as a control.
- **Pad++** (Bederson & Hollan, UIST '94) — coined the term "semantic zooming."
- **DeepZoom / Seadragon**, and **Maps LOD** (country labels → cities → streets → building footprints → indoor plans).
- **Apple / Google Photos** Years → Months → Days → All (distinct representations, not scalings); Calendar Day/Week/Month/Year.
- **Shneiderman's Visual Information-Seeking Mantra** (1996): "overview first, zoom and filter, then details-on-demand."

**Acceptance:** a new `semantic-zoom`/LOD intent definition lands (definitions only); its contract expresses a level axis selecting among distinct representations; the definition states its distinction from `viewport-transform` (geometric), `hierarchy` (traversal), and `density` (detail-tier), and cites the prior art; it passes `check:standards`.
