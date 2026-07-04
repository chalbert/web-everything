# Prior-art survey — side-by-side design-compare tool (#2224)

Date: 2026-07-04. Feeds the prepared decision #2224.

## The category is mature; the delta is *self-describing, in-app, brand/design-review* comparison

| Prior art | Modality it proves | What it lacks (the WE/Plateau delta) |
|---|---|---|
| **Chromatic / Percy** | branch-vs-branch, side-by-side + diff-highlight overlay in a review UI | hosted pixel diff of Storybook stories; a CI service, not an in-app dev tool; no declared-state model |
| **reg-suit / BackstopJS** | screenshot diff, onion-skin/blend toggle | build-time image diffing; opaque to *why* it changed |
| **Storybook** (a11y / interactions addons) | per-story panels, no native A/B compare | needs the Storybook harness; not a general two-render compare |
| **Figma / Framer** branching + compare | version A vs B side-by-side | design-file scope, not a running app's rendered output |
| **juxtapose.js (Knight Lab) · img-comparison-slider · react-compare-slider** | overlay **reveal-slider** (swipe) | image-only, static; a widget, not a tool wired to routes/variants |
| **Playwright trace viewer** | before/after DOM snapshots per action | debugging trace, not a design-judgment surface |
| **#1649 branch-and-run diff** | live dual-run, semantic state/render/rules diff | change-safety/regression, gated on the #142 capture substrate — heavy |

## Findings that reshape the forks

1. **Modality is not a fork — it is a set of view modes.** Panes, reveal-slider, opacity/onion-skin, and
   diff-highlight all coexist in the mature tools (Chromatic offers side-by-side *and* diff overlay). So
   the WE call is a **default mode**, not an either/or. Side-by-side panes is the most general (works for
   any two renders, any content); the reveal-slider (a `img-comparison-slider`-style custom element) is the
   strong second mode for pixel-close comparisons.
2. **"Dedicated tool vs component" is not a fork either** — every exemplar is a *component* (a slider
   widget, a diff view) mounted in a *surface* (a review page). Build the reusable compare view; surface it
   in a Tools entry. Support-both.
3. **The one real boundary is static vs live.** Static (two `iframe`s / two screenshots) ships with zero
   backend and no dependency on #142; the **live dual-run** end *is* #1649's substrate (event-mirroring +
   concurrent render). That is a genuine timing/scope fork, and it converges with #1649 rather than
   competing.
4. **Native-first:** the web platform has no "compare" primitive, but the reveal-slider is a well-trodden
   **custom element** (`img-comparison-slider`); two-pane is CSS grid + two `iframe`s. No framework needed —
   consistent with the native-first default (#75).
