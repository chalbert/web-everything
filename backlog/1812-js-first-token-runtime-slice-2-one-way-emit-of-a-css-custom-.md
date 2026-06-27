---
kind: story
size: 3
parent: "1683"
status: resolved
locus: frontierui
blockedBy: ["1811"]
dateOpened: "2026-06-27"
dateStarted: "2026-06-27"
dateResolved: "2026-06-27"
graduatedTo: 1683
tags: [design-tokens, theme, webinjectors, webtheme, css-custom-properties]
---

# JS-first token runtime — slice 2: one-way emit of a CSS custom property per resolved token (no drift)

From the single source slice 1 (#1811) builds, emit a CSS custom property per token (one-way **JS→CSS**, single-source so they can't drift), preserving cascade / light-DOM scope / dark-mode for paint. Carries the **single-source emit** residual #1682 deferred: how the injector's resolved set generates `--token-*` at **build** (static set) and at **registration** (dynamic / app-added set).

## Acceptance
- **Scope consistency** — a scoped subtree (`scoped-token-override`) resolves the **same** value whether read from JS (injector child scope) or painted by CSS (`--token-*` redeclaration), because both come from one source row.
- **No drift** — CSS custom properties are emitted from the injector, never hand-authored in parallel; removing/renaming a token updates both projections from the one source.

## Progress (batch-20260626-1811-1817-1819, cascade after #1811)

- Added `fui:plugs/webtheme/emitCss.ts` — the one-way JS→CSS projection over the slice-1 `ThemeSource`:
  - `emitTokenDeclarations(theme)` — the single derivation both paths share: `{ '--token-<family>-<name>': value }`, keys derived **only** from what the source resolves (the no-drift guarantee).
  - `emitTokenCss(theme, selector=':root')` — build-time / static-set emit (a CSS rule a build writes once).
  - `applyTokenVars(el, theme)` — registration-time / dynamic-set emit (`style.setProperty` on a live element / scope root).
  - `tokenVarName` / `TOKEN_VAR_PREFIX` (`--token`).
- Exported from `fui:plugs/webtheme/index.ts`.
- `fui:plugs/webtheme/__tests__/unit/emitCss.test.ts` — 6 cases, incl. both acceptance criteria: scope-consistency (a scoped subtree's painted `--token-color-primary` equals the JS `token()` read, same source row) and no-drift (a dropped/renamed source token drops/moves its property in lockstep). 17 webtheme tests green total.
- Slice 3 (#1813, migrate WE `:root`) is the remaining `blockedBy` this; it consumes `emitTokenCss`.
