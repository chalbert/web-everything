---
kind: decision
parent: "1975"
status: open
dateOpened: "2026-06-29"
tags: []
---

# Directive proposal — virtualized iteration (windowed list, content-visibility-backed)

Net-new directive candidate (#1975 catalog). Render only the visible window of a large list, recycling DOM as the user scrolls. Reimplemented everywhere (Angular CDK cdkVirtualFor, lit-labs virtualizer, TanStack Virtual, vue-virtual-scroller). Genuinely region-level; pairs with the native content-visibility primitive. Tree-shape clean (windowing is position, not computation). Decide at the #1963 bar.

## Example (proposed authoring)

```html
<!-- a `virtual` modifier on the existing for-each, not a new directive -->
<!-- for-each items="@rows as row" virtual item-size="40" -->
  <tr><td>${row.name}</td></tr>
<!-- /for-each -->

<!-- only the visible window stamps; the host scroller carries content-visibility:auto -->
```

- **Framework analog:** Angular `*cdkVirtualFor`, `@lit-labs/virtualizer` `virtualize()`, TanStack Virtual, vue-virtual-scroller.
- **Note:** prefer extending `ForEach` (#1130) with a `virtual` option over a separate directive; depends on the keyed-reconciliation + ownership work in the Phase-2 epic (#1971). Substrate: `content-visibility` + `IntersectionObserver`.
- **Form: Ⓒ comment** — a `ForEach` variant over live content, cloning the row `<template>` for the visible window (same form as #1130).
