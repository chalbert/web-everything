---
kind: story
size: 3
status: resolved
locus: webeverything
dateOpened: "2026-06-26"
dateStarted: "2026-06-27"
dateResolved: "2026-06-27"
graduatedTo: src/_data/intents/density.json
tags: [intent, density, explorer, intent-conformance]
---

# Quantify density intent spacing bands (gap ranges per level)

The density intent (we:src/_data/intents/density.json) ships quantified bands only for touch targets (comfortable 44px+ / compact 32px / wafer 24px); spacing and information-quantity are prose with no measurable gap ranges. The explorer's density reality-measurement oracle (#1698, contract ruled in #1791) measures a spacing/whitespace ratio against the declared band — so it needs quantified spacing bands (e.g. inter-element gap ranges per level) to divergence-check. Add them to the density intent schema. Blocks the density-reality slice of #1698; motion-reality is unblocked and ships independently.

## Progress
- Added a structured `metrics` object to `we:src/_data/intents/density.json`:
  - `interElementGap` — **the density signal** the oracle reads: contiguous, bounded px bands per level (comfortable 16–32, compact 8–16, wafer 2–8) so both *too tight* and *too sparse* diverge. Grounded in common scales (Consumer 16–24 / Enterprise-compact 8–16 / IDE-data-grid 2–8).
  - `touchTargetFloor` — the existing 44/32/24 numbers formalized into machine-readable bands, but **explicitly labelled the a11y lane, not the density metric** (per #1791 the touch-target floor was *refuted* as the density signal — it re-badges WCAG/axe). Carried only for level-vocabulary completeness.
- Updated the prose `description` to surface both gap and target per level and point at `metrics`.
- `check:standards` green; `eleventy` build clean. Unblocks the density-reality slice of #1698.
