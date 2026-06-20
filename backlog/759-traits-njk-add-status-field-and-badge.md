---
kind: story
size: 2
parent: "757"
locus: frontierui
status: resolved
dateOpened: "2026-06-16"
dateStarted: "2026-06-16"
dateResolved: "2026-06-16"
tags: []
---

# fui:traits.njk: add status field and badge

`fui:src/traits.njk` renders the trait catalog from `we:_data/traits.json`, but unlike `we:blocks.njk`/`fui:plugs.njk` it shows **no status** — only an optional `delivery` badge (lazy/eager). A not-ready trait is therefore indistinguishable from a shipped one, or simply left out of the JSON. Add an optional `status` field to each `we:traits.json` entry and render it with the shared `fui:status-badge.njk` macro, so trait readiness is exposed the same way blocks and plugs already are. Default any current trait without an explicit status to `active` (all 13 shipping traits today are real and on-disk: 4 reference + 9 `withX`).

## Acceptance

- `we:traits.json` entries accept an optional `status` field.
- `fui:traits.njk` renders a status badge per trait (via `fui:status-badge.njk`), falling back to `active` when unset.
- No visual regression to the existing `delivery` badge.

## Notes

- Sibling to the blocks/plugs status treatment; this just closes the one catalog that omits it.
- Pairs with #761 if the catalog is later auto-derived — status should be a first-class field either way.
