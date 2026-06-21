---
kind: story
size: 3
status: open
locus: frontierui
blockedBy: ["1492"]
dateOpened: "2026-06-21"
tags: [intent, selection, deselect, radio]
---

# FUI radio — toggle-off path + clear affordance (deselectable)

Ratified #1470: add the single-select deselect behavior to fui:blocks/radio/Radio.ts. Today select(index) sets el.checked = i===index across all options with no toggle-off path, so once a value is chosen exactly one stays checked forever. Add: re-activating the already-selected option clears it to no-selection (the survey's dominant radio trigger), gated on the deselectable config (default true, mirrors #1492 axis); roving-tabindex + onChange fire with an empty/undefined value on clear; a11y verified. Blocked by #1492 (consumes the deselectable axis). locus: frontierui.
