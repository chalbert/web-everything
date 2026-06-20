---
kind: epic
locus: frontierui
status: resolved
dateOpened: "2026-06-16"
dateResolved: "2026-06-16"
graduatedTo: none
tags: []
---

# FUI catalog pages: drive from real artifacts, expose status

The Frontier UI docs site (`:3001`) lists its own artifacts — adapters, blocks, plugs, traits, demos. An audit (2026-06-16) found only the demos page is genuinely **driven by the real artifacts**: `fui:src/_data/demos.js` globs `demos/*.html`. Every other catalog is a hand-maintained list (`fui:blocks.json`/`we:plugs.json`/`we:traits.json`) or, worst case, inline HTML (`fui:adapters.njk` hardcodes its two cards), so a page can silently drift from the code and not-ready artifacts get hidden instead of shown with an honest status. This epic makes the catalogs reflect what exists and expose each artifact's status, taking `fui:demos.js` as the reference pattern.

## Audit findings (2026-06-16)

| Page | Source | Real-artifact driven? | Status shown? |
|---|---|---|---|
| `we:src/demos.njk` | `fui:_data/demos.js` — globs `demos/*.html` | ✅ auto-discovered | n/a |
| `we:src/blocks.njk` / `we:src/index.njk` | `fui:_data/blocks.json` (hand-list, 23) | ⚠️ hand-maintained | ✅ all `active` |
| `we:src/block-pages.njk` | `fui:blocks.json` paginated | ⚠️ hand-list | ✅ (+ stale copy → #760) |
| `fui:src/plugs.njk` | `we:_data/plugs.json` (hand-list, 9) | ⚠️ hand-maintained | ✅ all `active` |
| `fui:src/traits.njk` | `we:_data/traits.json` (hand-list, 13) | ⚠️ hand-maintained | ❌ no status badge |
| `fui:src/adapters.njk` | inline HTML, 2 cards | ❌ hardcoded | ❌ none |
| `we:src/about.njk` | static prose | n/a | n/a |

The hand-lists are in sync with disk *today* (e.g. we:traits.json's 13 ↔ 9 `withX` + 4 reference traits on disk match), but nothing keeps them in sync.

## Children

- #758 — `fui:adapters.njk`: drive from `webdocs/adapters/*`, expose status (worst offender; relates to resolved #741)
- #759 — `fui:traits.njk`: add a status field + badge
- #760 — block detail pages: refresh the stale "not yet migrated to FrontierUI" copy
- #761 — auto-derive (or drift-check) the blocks/plugs/traits catalogs from disk
