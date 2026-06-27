---
kind: story
size: 5
parent: "777"
status: open
dateOpened: "2026-06-27"
tags: []
---

# Grow we-filter-chip a rich structured-count + colour-variant API (summary-pill capability)

Extend FUI we-filter-chip with a rich/structured-count API (a slot or structured sub-count attribute) plus a per-chip semantic colour-variant, so a chip can render nested colour-coded sub-counts (e.g. prepared / in-flight / preparing) and a hard background — the capability the six /backlog/ Prioritisation summary pills need. Today decorate() overwrites el.innerHTML (fui:blocks/filter-chip/FilterChipElement.ts:40) and exposes only a scalar count, erasing any authored sub-spans. Carved from #1866; the true #777 dogfood end-state for the summary pills. Locus: fui.
