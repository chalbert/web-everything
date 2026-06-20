---
kind: task
parent: "149"
status: resolved
dateOpened: "2026-06-07"
dateResolved: "2026-06-09"
graduatedTo: block:droplist
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

## Resolution (2026-06-09)

Native `shift` no longer emits `flip-start`. The native strategy
(`fui:blocks/droplist/positioning/native.ts` in Frontier UI) now derives a `shift`
fallback set of **same-side `position-area` variants** that slide the surface
along the axis *perpendicular* to its placement side, and lets the browser pick
the first that fits — a discrete slide, not a diagonal flip:

```ts
// bottom / top  → slide along the inline axis (span-right ↔ span-left)
// left / right   → slide along the block axis  (span-bottom ↔ span-top)
if (shift) fallbacks.push(...shiftFallbacks(placement));
// e.g. bottom-start → "bottom, bottom span-left";  right-start → "right, right span-top"
```

CSS Anchor Positioning has no continuous clamp (the JS path uses `Math.min`/`max`),
so this discrete same-side slide is the native-first realization of "stay on-screen
along the axis." Centered variant is listed first (most balanced, fits most often),
then the opposite extreme.

Validated:
- Unit — `fui:blocks/droplist/positioning/__tests__/strategies.test.ts`: asserts
  `shift` emits axis-slide `position-area`s and **never** `flip-start`.
- Real browser — `fui:blocks/droplist/positioning/__tests__/e2e/shift.spec.ts` +
  `fui:demos/positioning-shift.html`: a `bottom-start` surface parked against the right
  viewport edge slides back on-screen along the inline axis and **stays below** its
  trigger (no diagonal flip) under **both** the native and JS strategies.
