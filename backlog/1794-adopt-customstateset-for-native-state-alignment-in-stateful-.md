---
kind: story
size: 3
status: open
dateOpened: "2026-06-26"
tags: [custom-state-set, states, native-first, a11y]
---

# Adopt CustomStateSet for native :state alignment in stateful blocks

`ElementInternals.states` (the `CustomStateSet` API) lets a custom element expose internal states that style via the native `:state(...)` selector, instead of reflecting boolean attributes/classes. Per the native-first default, stateful blocks should start as standard-aligned as possible — so we should review where blocks currently model internal state ad-hoc and adopt `CustomStateSet` where it's the right primitive.

Review pass first: which blocks expose internal state, what they use today (attributes/classes/data-*), and where `:state()` is the better fit. Then adopt it in the clear cases and document the convention.

## Build
- Survey stateful blocks; identify ad-hoc state modeling that `CustomStateSet` would replace.
- Adopt `ElementInternals.states` + `:state()` styling in the blocks where it fits.
- Capture the convention so new blocks reach for it by default.

## Acceptance
- At least the clear-fit blocks expose state via `CustomStateSet` and style through `:state()`.
- The convention is documented; a demo case shows `:state()` styling.
- `check:standards` green.

_Converted from `we:plans/CustomStateSet.md` (#1792 hidden-docs cleanup)._
