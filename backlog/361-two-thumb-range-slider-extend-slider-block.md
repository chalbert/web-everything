---
type: idea
workItem: story
size: 2
parent: "315"
status: resolved
dateStarted: "2026-06-12"
dateOpened: "2026-06-12"
dateResolved: "2026-06-12"
graduatedTo: "block:slider"
tags: []
---

# Two-thumb range slider (extend slider block)

Two-thumb range slider — extend block:slider (currently single-thumb) to min/max range selection: two role=slider thumbs, keyboard + drag, value clamping, no thumb crossover. Gap from the competitive coverage analysis (#347). A small, bounded extension of an existing block. Candidate from the gap sweep.

## Outcome (2026-06-12)

**Not a gap — the slider block standard already specifies the dual-thumb range.** On going to fill this,
`block:slider` (fui:blocks.json + `we:block-descriptions/slider.njk`) was found to fully cover it: summary reads
"selecting a numeric value — or a min–max range", a design decision "Dual-thumb range is two bound values,
not one element" (ordered, no crossover, reported as a pair = the Selection Intent's `range` variant), and
the njk has a dedicated "Altitude — dual-thumb range (the native gap)" section. So there is **no WE standard
work**; only the Frontier UI implementation is pending (true of every draft block).

The #347 coverage assessment was too coarse (labelled range-slider "partial / single-thumb" without reading
the slider spec closely). Corrected `we:benchmarkCoverage.json`: range-slider moved from `gaps` to covered
(fileableGaps 7 → 6, partial 23, covered 53). This is the sweep self-correcting at fill time — the same
discipline as #348's dedup catching already-tracked items.

**Graduated to** `block:slider` — dual-thumb range variant of slider; impl pending in Frontier UI.
