---
type: issue
workItem: task
parent: "149"
status: open
dateOpened: "2026-06-07"
tags: [droplist, anchor, positioning, css-anchor, shift, native]
relatedReport: reports/2026-06-02-dropdown-trait-composition.md
relatedProject: webblocks
crossRef: { url: /backlog/161-native-anchor-flip-viewport-overflow/, label: Native flip fix }
---

# Native positioning strategy: `shift` maps to `flip-start` (wrong semantics)

Surfaced closing [#161](/backlog/161-native-anchor-flip-viewport-overflow/). The
`shift` intent is documented as "slide along the axis to stay within the viewport"
(the JS strategy clamps `left`/`top` onto the viewport accordingly). But the
**native** strategy realizes `shift` by pushing `flip-start` onto
`position-try-fallbacks`:

```ts
if (shift) fallbacks.push('flip-start');
```

`flip-start` flips the surface across the start↔end **diagonal** (swapping the
block/inline axes) — that is not an axis slide. So native `shift` does something
different from (and weaker than) the documented intent and the JS path.

CSS Anchor Positioning has no single "shift" keyword; native shift likely needs a
custom `@position-try` block (or `position-area` + inset adjustment) that slides the
surface along the axis. Pick the native-first realization so `shift` keeps a surface
on-screen along the axis without flipping it across the diagonal.

Acceptance: with the **native** strategy and `shift` (flip off), a surface whose
inline/block extent would spill off one edge slides back on-screen along that axis
(not diagonally flipped) — validated in a real browser alongside the JS strategy.
