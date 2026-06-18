---
type: issue
workItem: story
size: 3
parent: "149"
status: resolved
dateOpened: "2026-06-09"
dateStarted: "2026-06-09"
dateResolved: "2026-06-09"
tags: [droplist, anchor, positioning, resize, shift, autocomplete]
relatedReport: reports/2026-06-02-dropdown-trait-composition.md
relatedProject: webblocks
crossRef: { url: /backlog/179-native-resize-is-a-noop/, label: Native resize fix }
---

# `resize`/`shift` work in the strategy but no shipping consumer turns them on

Surfaced closing [#179](/backlog/179-native-resize-is-a-noop/). Both positioning
strategies now honor `resize` (native caps the surface at the `position-area` cell
via a fill-available `max-block-size`; JS computes the pixel room) and `shift`, and
each is covered by a standalone demo + e2e. But the only shipping consumer,
`<auto-complete>`, hardcodes its `Anchored` options to `{ placement: 'bottom-start',
flip: true }` ([fui:AutoComplete.ts](frontierui/blocks/droplist/AutoComplete.ts) ~L215)
and never passes `resize` or `shift`. So through the real element those flags are
unreachable — they are exercised only by direct `strategy.place(...)` calls in the
demos.

Wire the flags through to consumers: expose `resize` and `shift` (boolean
attributes / properties) on `<auto-complete>` (and any other surface that composes
`Anchored`), flowing into `Anchored.options`, so a long list near a viewport edge can
actually shrink-and-scroll in the shipping component, not just in the strategy demo.

Acceptance: setting `resize` (and `shift`) on `<auto-complete>` flows into the
positioning strategy and is observable in a real browser — a too-tall listbox near
the bottom edge shrinks and scrolls internally rather than overflowing.

## Resolution (2026-06-09)

Wired the flags through the only shipping consumer (`<auto-complete>` is the sole
`new Anchored()` site — no other surface needed touching):

- `fui:frontierui/blocks/droplist/AutoComplete.ts` — `resize`/`shift` added to
  `observedAttributes`; the initial `Anchored.options` now reads them off the
  attributes; `attributeChangedCallback` re-applies on runtime toggle; reflecting
  `resize`/`shift` boolean **properties** added.
- `fui:frontierui/blocks/droplist/Anchored.ts` — new `update(patch)` that merges option
  flags and tears-down + re-places when already connected (the strategy `place()`
  ran once on connect, so a live flag change needs a re-place to take effect).
- **Demo + e2e (DoD):** `fui:demos/autocomplete-unplugged.ts` Card 6 (`resize`+`shift`
  near the viewport bottom, long list, static cap lifted so the fill-available
  `max-block-size` binds); `fui:blocks/droplist/__tests__/e2e/auto-complete.spec.ts`
  asserts the wire-through on the surface (inline `max-block-size` fill-available +
  axis-slide `position-try-fallbacks`) and that it stays on-screen.
- **Unit:** `fui:AutoComplete.test.ts` — attribute, runtime-toggle, and property paths.

Green: frontierui `tsc`, 1304 unit, 6 e2e (`fui:auto-complete.spec.ts`), `check:standards`.
