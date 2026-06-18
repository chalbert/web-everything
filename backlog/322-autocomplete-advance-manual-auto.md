---
type: idea
workItem: story
size: 2
status: resolved
dateOpened: "2026-06-11"
dateStarted: "2026-06-12"
dateResolved: "2026-06-12"
graduatedTo: "block:autocomplete"
tags: [autocomplete, dropdown, collection-ops, pagination, async, infinite-scroll]
---

# Wire Collection Operations advance:manual|auto onto autocomplete (default auto + manual fallback)

Wire Collection Operations' existing `advance: manual | auto` dimension onto the autocomplete member, defaulting to `auto` (an `IntersectionObserver` scroll sentinel triggers the next-page fetch) with a clicked "Load more" row as the keyboard / screen-reader fallback. The dimension already lives on grids/data tables but was never connected to the dropdown family. Ratified in #018 (Fork 2): every surveyed library defaults to scroll-triggered auto-load, so `auto` is the most-flexible default and `manual`-only is the author opt-in — no new contract, just family wiring over the already-owned dimension.

## Progress

**Resolved 2026-06-12.** Family wiring landed as two registry edits, no new contract:

- **`fui:src/_data/blocks.json`** — added `collection-operations` to the `autocomplete` block's `composesIntents`, and a `designDecision` documenting the per-member default override: autocomplete is the one member that pins `advance: auto` (vs. the family/grid default `manual`), because a bounded listbox popover has no unreachable-footer harm and every surveyed combobox auto-loads at the scroll boundary (#018 Fork 2). The decision records the mechanics — append+auto = an `IntersectionObserver` sentinel at the listbox boundary coordinating with the already-composed `loader` (loadingMore, ~250ms debounce, stale-cancel) and `windowed-collection`; the manual fallback = a keyboard-reachable, `live-region-status`-announced "Load more" row.
- **`we:src/_data/intents.json`** — extended the Collection Operations `advance` dimension description so the "never the default" rule is scoped to full-page collections, with the bounded-surface exception (dropdown/autocomplete family pins `auto`) noted inline — keeps the registry self-consistent with the block-level override.

Implementation layer (Filter + Windowed + Loader in Frontier UI's `blocks/droplist/`) already has the pieces; this exposes the dimension that was architecturally ready. Gate: `check:standards` 0 errors; standards-validation vitest suites green (77 tests).

**Graduated to** `block:autocomplete` — via collection-operations.advance wiring.
