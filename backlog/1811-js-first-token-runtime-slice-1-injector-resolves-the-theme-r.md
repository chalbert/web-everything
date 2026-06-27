---
kind: story
size: 5
parent: "1683"
status: resolved
locus: frontierui
dateOpened: "2026-06-27"
dateStarted: "2026-06-27"
dateResolved: "2026-06-27"
graduatedTo: 1683
tags: [design-tokens, theme, webinjectors, webtheme, native-first]
---

# JS-first token runtime — slice 1: injector resolves the theme, readable synchronously off-DOM

The foundational slice of #1683 (model ratified in #1682, `we:docs/agent/platform-decisions.md#tokens-js-first`). Greenfield: FUI has `fui:plugs/webinjectors` + `fui:plugs/webcontexts` but **no** theme/token-resolution substrate yet (no `webtheme` dir, no token-resolve code). Build the injector-as-theme-source-of-truth: every CSS-relevant token family (color, spacing, radius, shadow, font) resolvable **synchronously by any JS, off-DOM, no cascade, no `getComputedStyle`**. Unblocks the three off-DOM consumers that motivated #1682 and are independent of any CSS emit.

## Acceptance
- **Pre-attach compute** — a custom element reads its resolved theme in its **constructor**, before it is in the DOM, no `getComputedStyle`, no FOUC.
- **Worker / OffscreenCanvas** — code with no DOM paints with a theme colour read from the injector (or a posted snapshot of it).
- **Console** — `console.log("%c…", "color: …")` uses a theme colour with no element to query.

Slices 2 (#1812, one-way CSS emit) and 3 (#1813, migrate WE `:root`) build on this and are `blockedBy` it.

## Progress (batch-20260626-1811-1817-1819)

Built the greenfield `fui:plugs/webtheme/` substrate:
- `fui:plugs/webtheme/tokens.ts` — `TokenFamily` (color·spacing·radius·shadow·font), `ResolvedTheme` (plain-string records, so a snapshot is `structuredClone`/`postMessage`-safe), `TOKEN_FAMILIES`.
- `fui:plugs/webtheme/ThemeSource.ts` — the injector-held SoT: `token()`/`has()`/`family()`/`snapshot()`/`with()`, synchronous, off-DOM, no cascade, no `getComputedStyle`; parent-chain delegation = the runtime `scoped-token-override` building block for slices 2/3.
- `fui:plugs/webtheme/defaultTheme.ts` — platform-default resolved theme (the JS baseline slice 3 migrates `:root` into).
- `fui:plugs/webtheme/resolveTheme.ts` — module-scope `getRootTheme()`/`setRootTheme()` (readable with **no node**) + `resolveTheme(node?)` that consults the node's injector chain (`THEME_PROVIDER` provider) first, root fallback.
- Registered the plug in `fui:src/_data/plugs.json` (type `Theme`).
- 11 vitest cases cover all three acceptance criteria (constructor pre-attach + `getComputedStyle` never called; worker snapshot survives `structuredClone`; `console.log("%c")` from a token) plus scoped-override resolution.
