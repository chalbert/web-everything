---
type: issue
workItem: task
parent: "149"
status: open
dateOpened: "2026-06-07"
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
