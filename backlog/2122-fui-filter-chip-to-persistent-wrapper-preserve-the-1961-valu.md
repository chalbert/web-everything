---
kind: story
size: 2
parent: "2015"
status: open
locus: frontierui
blockedBy: ["1974"]
dateOpened: "2026-07-02"
tags: []
---

# FUI: filter-chip to persistent wrapper (preserve the #1961 value/aria-pressed surface)

Migrate fui:blocks/filter-chip/FilterChipElement.ts off transient self-erasure: the we-filter-chip host persists wrapping the native <button> (#1962 single-native-control family — the epic body's 'behaviour-free leaf in #1974' claim was a mis-family, corrected by the 2026-07-02 split analysis). Preserve the #1961 exposed surface: value copied verbatim onto the inner control, selected→aria-pressed stays the one forced a11y rename. Update blocks/filter-chip unit tests. Locus: frontierui.
