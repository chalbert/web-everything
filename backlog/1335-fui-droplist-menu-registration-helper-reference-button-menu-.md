---
kind: story
size: 5
locus: frontierui
status: open
dateOpened: "2026-06-20"
tags: []
---

# FUI droplist menu registration helper + reference button-menu composition (registerNavigation analogue)

Add a **droplist menu registration helper** to FUI (`fui:blocks/droplist/`) — the
`registerNavigation(attributes)` analogue for a button-anchored menu — plus a **reference composition**
(demo/test) that wires the raw `Anchor` / `Anchored` / `Selection` / `FocusDelegation` (+ optional
`type-ahead`) behaviors into a working trigger→menu against the `[composite-descendant]` + aria-controls
DOM contract. Today only `AutoComplete` (`<we-autocomplete>`, a combobox) ships as a composed,
registerable element; the menu behaviors are "consumed directly" with no `register*` and **no reference
button-menu exists**, so every consumer must reverse-engineer the multi-behavior contract. This helper +
reference makes menu adoption a clean consumer wiring.

## Why filed

Surfaced during batch-2026-06-20 pre-flight of `#1285` (plateau auth/profile menu onto FUI droplist),
which assumed a `registerNavigation`-style seam that doesn't exist for menus. `#1285` is `blockedBy` this.
Mirror the `fui:blocks/navigation` `registerNavigation` pattern and the existing
`fui:demos/autocomplete-unplugged.ts` registration style.
