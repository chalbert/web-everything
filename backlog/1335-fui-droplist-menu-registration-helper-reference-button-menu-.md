---
kind: story
size: 5
locus: frontierui
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "fui:blocks/droplist/registerDroplistMenu.ts"
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

## Progress

- Added `fui:blocks/droplist/registerDroplistMenu.ts` — the `registerNavigation` analogue for a
  button-anchored menu. One call registers the menu behaviors under their **canonical declarative
  attribute names** (sourced from the behaviors' own doc-comments): `anchor` (trigger), `anchored`
  (surface), `selection`, `focus-delegation`, and the optional `type-ahead` (delegated to the existing
  `registerTypeAhead`, skippable via `{ typeAhead: false }`). A consumer now wires a button-menu purely
  in HTML against the `[composite-descendant]` + `aria-controls` contract — documented inline as the
  reference snippet.
- Added `fui:blocks/droplist/__tests__/registerDroplistMenu.test.ts` (5 tests) — (1) the helper
  registers the four core names + optional type-ahead (and skips it on `{typeAhead:false}`); (2) a
  **reference button-menu composition** proving the raw behaviors compose into a working trigger→menu:
  the trigger opens/dismisses the `[aria-controls]` menu (`anchor` → `aria-expanded` + `hidden`),
  `focus-delegation role:menu` stamps `menuitem` on the `[composite-descendant]` children, and
  `focus-delegation`+`selection` commit the active item on Enter (`aria-selected`).
- Declared the four registered names on the `droplist` block entry in `fui:src/_data/blocks.json`
  (#783 sibling-drift gate requires any disk-registered name to be cataloged).
- Gates green for this changeset: droplist suite 113/113; `check:standards` clean of my files (the 2
  remaining errors are pre-existing `notification/`+`signature-pad/` catalog drift, external). Unblocks
  `#1285`.
