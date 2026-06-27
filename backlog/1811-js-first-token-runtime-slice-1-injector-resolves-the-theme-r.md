---
kind: story
size: 5
parent: "1683"
status: open
locus: frontierui
dateOpened: "2026-06-27"
tags: [design-tokens, theme, webinjectors, webtheme, native-first]
---

# JS-first token runtime — slice 1: injector resolves the theme, readable synchronously off-DOM

The foundational slice of #1683 (model ratified in #1682, `we:docs/agent/platform-decisions.md#tokens-js-first`). Greenfield: FUI has `fui:plugs/webinjectors` + `fui:plugs/webcontexts` but **no** theme/token-resolution substrate yet (no `webtheme` dir, no token-resolve code). Build the injector-as-theme-source-of-truth: every CSS-relevant token family (color, spacing, radius, shadow, font) resolvable **synchronously by any JS, off-DOM, no cascade, no `getComputedStyle`**. Unblocks the three off-DOM consumers that motivated #1682 and are independent of any CSS emit.

## Acceptance
- **Pre-attach compute** — a custom element reads its resolved theme in its **constructor**, before it is in the DOM, no `getComputedStyle`, no FOUC.
- **Worker / OffscreenCanvas** — code with no DOM paints with a theme colour read from the injector (or a posted snapshot of it).
- **Console** — `console.log("%c…", "color: …")` uses a theme colour with no element to query.

Slices 2 (#1812, one-way CSS emit) and 3 (#1813, migrate WE `:root`) build on this and are `blockedBy` it.
