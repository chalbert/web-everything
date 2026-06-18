---
type: issue
workItem: task
parent: "149"
status: resolved
dateOpened: "2026-06-07"
dateStarted: "2026-06-09"
dateResolved: "2026-06-09"
tags: [droplist, anchor, positioning, css-anchor, resize, native]
relatedReport: reports/2026-06-02-dropdown-trait-composition.md
relatedProject: webblocks
crossRef: { url: /backlog/161-native-anchor-flip-viewport-overflow/, label: Native flip fix }
---

# Native positioning strategy: `resize` is a no-op

Surfaced closing [#161](/backlog/161-native-anchor-flip-viewport-overflow/). When
`resize` is requested, the **native** strategy emits:

```css
overflow: auto;
max-block-size: var(--anchored-available-block-size, auto);
```

but nothing ever populates `--anchored-available-block-size`, so it resolves to
`auto` and the surface never actually shrinks — it overflows instead. The **JS**
strategy, by contrast, computes a real pixel `max-block-size` from the viewport
room on the chosen side.

The native path should constrain the surface to the space the browser found,
natively — e.g. via the `anchor-size()` function and/or the CSS
`position-area`/available-space sizing keywords — so `resize` shrinks the surface
on the native path the way it does on the JS path, with no script.

Acceptance: with the **native** strategy and `resize`, a surface taller than the
available space shrinks (and scrolls internally) rather than overflowing — validated
in a real browser alongside the JS strategy.

## Resolution (2026-06-09)

The native strategy's `resize` branch in
[fui:native.ts](frontierui/blocks/droplist/positioning/native.ts) now caps the surface
with a **fill-available** `max-block-size` instead of the dead
`var(--anchored-available-block-size, auto)`. Under `position-area` the surface's
containing block *is* the grid-area cell — the space between the anchor edge and the
viewport edge (confirmed against MDN) — so `max-block-size: stretch` (with
`-webkit-fill-available` for anchor-positioning engines that predate unprefixed
`stretch`) resolves to exactly the room the browser found, natively, with no script.
The `--anchored-available-block-size` custom property is kept as a host override seam,
but its fallback is now a real available-space keyword rather than `auto`.

Validated:
- Unit — `fui:blocks/droplist/positioning/__tests__/strategies.test.ts` asserts the
  native `resize` styles are the available-space cap, not the `auto` no-op, and tear
  down cleanly.
- Real browser — `fui:blocks/droplist/positioning/__tests__/e2e/anchored-resize.spec.ts`
  on `fui:/demos/anchored-resize.html` opens a 24-option surface in a short (520px)
  viewport with the **native** and **JS** strategies side by side; both clamp to ~the
  room below the trigger, stay within the viewport, and scroll internally.

Follow-up: [#230](/backlog/230-anchored-resize-shift-not-exposed-on-consumers/) — the
flags work in the strategy but `<auto-complete>` (the only shipping consumer)
hardcodes `flip: true` and never passes `resize`/`shift`, so they are reachable only
via direct `strategy.place(...)` in the demos.
