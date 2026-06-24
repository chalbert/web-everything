---
kind: story
size: 3
parent: "1734"
status: resolved
dateOpened: "2026-06-24"
dateStarted: "2026-06-24"
dateResolved: "2026-06-24"
graduatedTo: 1734
tags: []
---

# Mint the region-select intent — full shape/mode/modifier vocabulary

Foundational WE slice (locus we:). Author we:src/_data/intents/region-select.json — the standard that names the full shape: rect | lasso | polygon | nearest dimension up front, plus the hit-test mode (intersect | contain | center) and modifier (replace | add | toggle | subtract) vocabulary, with description HTML and requiresCapabilities. Definition-only work, permitted in WE (the zero-impl rule exempts definitions); we:gesture.json is the structural precedent (recognizer-adjacent intent, engine is an impl seam). Every realization declares its shape value against this contract, so it gates slices B-D. Demoable: /intents/region-select/ renders the full dimension set. Graduated from #1463 GO.

## Progress (batch-2026-06-23-1725-1665)

Slice A landed — the region-select intent is minted with the full vocabulary:

- `we:src/_data/intents/region-select.json` — `shape` (rect | lasso | polygon | nearest), `mode` (intersect | contain | center, default intersect), `modifier` (replace | add | toggle | subtract, default replace), full description HTML, `requiresCapabilities: []`. Designed in full up front (completeness-early #1463); composes the Selection Intent; geometry engine left as an FUI impl seam. we:gesture.json is the structural precedent followed.
- `we:src/_data/semantics/region-select.json` — matching glossary term (clears the #1327 coverage warn; sibling intents all carry one).
- Renders at `/intents/region-select/` with the full dimension set.

Definition-only (zero-impl rule exempts definitions). Gates the FUI realization slices B–D (marquee-select = the rect member). Graduated from #1463 GO.
