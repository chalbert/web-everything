---
kind: story
size: 3
status: open
locus: webeverything
dateOpened: "2026-06-26"
tags: [intent, density, explorer, intent-conformance]
---

# Quantify density intent spacing bands (gap ranges per level)

The density intent (we:src/_data/intents/density.json) ships quantified bands only for touch targets (comfortable 44px+ / compact 32px / wafer 24px); spacing and information-quantity are prose with no measurable gap ranges. The explorer's density reality-measurement oracle (#1698, contract ruled in #1791) measures a spacing/whitespace ratio against the declared band — so it needs quantified spacing bands (e.g. inter-element gap ranges per level) to divergence-check. Add them to the density intent schema. Blocks the density-reality slice of #1698; motion-reality is unblocked and ships independently.
