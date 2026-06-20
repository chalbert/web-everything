---
kind: story
size: 2
parent: "468"
status: resolved
dateOpened: "2026-06-13"
dateStarted: "2026-06-13"
dateResolved: "2026-06-13"
graduatedTo: "block:toggle-switch"
tags: []
---

# Toggle / switch block — boolean on/off

Native-first block over `<input type=checkbox>` with role=switch: a boolean on/off control distinct from checkbox semantics. Sliced from #468.

## Resolved 2026-06-13 (batch-2026-06-13)

Authored the `toggle-switch` block standard: [fui:blocks.json](../src/_data/blocks.json) entry (status
`draft`, type Component, `implementsIntent: input`) + required
[we:block-descriptions/toggle-switch.njk](../src/_includes/block-descriptions/toggle-switch.njk) (renders
live at `/blocks/toggle-switch/`).

- **Native-first**: `<input type="checkbox" role="switch">` + label, zero JS (a pure-action variant may
  be `<button aria-pressed>`).
- **Strictly binary**: `aria-checked` true/false, **no** mixed/indeterminate state (the key contrast
  with the checkbox).
- **Immediate vs. deferred** is THE distinction from checkbox (#472): a switch applies on toggle, a
  checkbox stages a value for submit — same `<input type=checkbox>` substrate, different role + timing,
  separate blocks (not a checkbox mode flag). WAI-ARIA APG Switch alignment.

No `sourcePath` — the native element carries it; any styling/behavior is a deferred Frontier UI build.
