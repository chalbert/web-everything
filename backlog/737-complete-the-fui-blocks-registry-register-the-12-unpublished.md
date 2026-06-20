---
kind: story
size: 5
parent: "723"
locus: frontierui
status: resolved
dateOpened: "2026-06-16"
dateStarted: "2026-06-16"
dateResolved: "2026-06-16"
tags: []
---

# Complete the FUI blocks registry — register the 12 unpublished blocks + spec pages

12 of 19 FUI block impls are absent from fui:src/_data/blocks.json so they never render publicly; author each {id,name,type,summary,protocol,weSpecPath} (curated ids, not dir-names) + ensure a /blocks/{id}/ page. From the #723 audit.

## Progress

- Registered the unpublished FUI block impls in `fui:src/_data/blocks.json` (7 → **23** entries). Each entry uses a **curated id that equals an existing WE block id** (not the dir name), so the existing cross-repo `weSpecPath` invariant (`we:scripts/check-standards.mjs` §51–61) resolves; `name`/`type`/`summary` are taken from WE's authoritative `fui:blocks.json` (first-sentence summary), `protocol` maps each block to the WE plug it builds on (matching the existing 7's convention), `status: active`.
- The 16 registered: audit-trail, background-task-surface, data-grid, droplist, for-each, lifecycle, master-detail, nav-list, resource-loader, selection, stepper, tree-select, type-ahead, double-curly-bracket-parser, double-square-bracket-parser, interpolation-text-node.
- `/blocks/{id}/` detail pages auto-generate from the manifest (`we:block-pages.njk` paginates `fui:blocks.json`) — verified all 16 render in the 11ty build; the catalog index now shows 23 cards. Gate: `check:standards` 0 errors (23 blocks).
- **Count note:** the item estimated 12; the actual set of FUI impls absent from the registry **and** mapping cleanly to a WE spec id is **16** (the extra 4 are the two bracket parsers, interpolation-text-node, and audit-trail). Registered all 16 — more complete, all gate-valid. Impls with **no** WE spec id stay unregistered (nav-section, the call/pipe/value parser internals, the 4 traits) — those belong to the #731 family/mapping decision, not here.
