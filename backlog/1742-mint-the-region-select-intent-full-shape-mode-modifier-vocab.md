---
kind: story
size: 3
parent: "1734"
status: open
dateOpened: "2026-06-24"
tags: []
---

# Mint the region-select intent — full shape/mode/modifier vocabulary

Foundational WE slice (locus we:). Author we:src/_data/intents/region-select.json — the standard that names the full shape: rect | lasso | polygon | nearest dimension up front, plus the hit-test mode (intersect | contain | center) and modifier (replace | add | toggle | subtract) vocabulary, with description HTML and requiresCapabilities. Definition-only work, permitted in WE (the zero-impl rule exempts definitions); we:gesture.json is the structural precedent (recognizer-adjacent intent, engine is an impl seam). Every realization declares its shape value against this contract, so it gates slices B-D. Demoable: /intents/region-select/ renders the full dimension set. Graduated from #1463 GO.
