---
kind: story
size: 5
status: active
dateOpened: "2026-07-01"
dateStarted: "2026-07-01"
tags: []
---

# Execute behaviour-attr colon migration (family-only per #1991)

Mechanical cross-repo rename ratified by #1991: colon-ify only genuine families — droplist-anchor/anchored/selection → droplist:*, and route:guard:leave → route:guard-leave. Leave family-less attrs (type-ahead, focus-delegation, navigation-guard) bare. Covers ~30 FUI code sites (getAttribute/matches reads), FUI demos (data-grid, droplist-selection, autocomplete-unplugged), ~10 WE block-description docs, back-compat aliases for changed names (author surfaces depend on old names), and all-engine tests. Family-less attrs unchanged.
