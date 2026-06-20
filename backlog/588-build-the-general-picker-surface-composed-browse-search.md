---
kind: story
size: 5
parent: "586"
status: resolved
blockedBy: ["587"]
dateOpened: "2026-06-14"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: "block:picker-surface (src/_data/blocks.json)"
tags: []
---

# Build the general picker surface (composed browse↔search)

Build the one general picker surface per #370 Fork 4 (compose, don't reinvent): popover container + search input intent + category grid, reusing droplist/autocomplete. Specify the APG Grid (2-D arrow nav, browse) ↔ Combobox/listbox (search) focus hand-off — the load-bearing a11y transform. Promote to a thin block ONLY if that hand-off can't be expressed as config over droplist/autocomplete. This surface is instantiated by many specific picker contexts (separate stories): full-page filtered collection, in-editor tooltip picker, reaction quick-picker.

## Progress

- **Resolved 2026-06-14.** Built the general picker surface as the `picker-surface` Component block
  in [fui:blocks.json](../src/_data/blocks.json) + its page
  [we:block-descriptions/picker-surface.njk](../src/_includes/block-descriptions/picker-surface.njk),
  mirroring the sibling `reaction` block (#589).
- **Promotion-trigger determination (the pinned #370 Fork 4 condition): RESOLVED → thin block.**
  The hand-off cannot be expressed as config over droplist/autocomplete: `autocomplete` is the 1-D
  combobox half only (no browse-grid), so the picker composes its search half with a 2-D grid + a
  mode switch. Each half is individually a `focus-delegation` config (so the block defers all focus
  mechanics and stays thin — `composesIntents` only, no re-spec), but the **query-driven swap between
  two focus-delegation profiles on two surfaces** (grid↔listbox role + dimensionality change) is
  bespoke coordination no intent owns. Reinforced by focus-delegation's own open question (2-D ragged
  grid mechanics under-specified). The block owns ONLY the hand-off.
- **Composes:** anchor (popover) · input (search field) · focus-delegation (both the 2-D grid roving
  and the 1-D combobox virtual profiles) · selection · live-region-status · windowed-collection ·
  expressive-symbol (glyphs deferred, never re-rendered).
- The three specific picker contexts (full-page filtered collection / in-editor tooltip picker /
  reaction quick-picker) are noted as separate later stories that instantiate this one surface.
