---
kind: story
size: 3
parent: "1683"
status: open
locus: frontierui
blockedBy: ["1811"]
dateOpened: "2026-06-27"
tags: [design-tokens, theme, webinjectors, webtheme, css-custom-properties]
---

# JS-first token runtime — slice 2: one-way emit of a CSS custom property per resolved token (no drift)

From the single source slice 1 (#1811) builds, emit a CSS custom property per token (one-way **JS→CSS**, single-source so they can't drift), preserving cascade / light-DOM scope / dark-mode for paint. Carries the **single-source emit** residual #1682 deferred: how the injector's resolved set generates `--token-*` at **build** (static set) and at **registration** (dynamic / app-added set).

## Acceptance
- **Scope consistency** — a scoped subtree (`scoped-token-override`) resolves the **same** value whether read from JS (injector child scope) or painted by CSS (`--token-*` redeclaration), because both come from one source row.
- **No drift** — CSS custom properties are emitted from the injector, never hand-authored in parallel; removing/renaming a token updates both projections from the one source.
