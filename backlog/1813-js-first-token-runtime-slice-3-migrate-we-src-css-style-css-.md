---
kind: story
size: 3
parent: "1683"
status: open
locus: webeverything
blockedBy: ["1824"]
dateOpened: "2026-06-27"
tags: [design-tokens, theme, webinjectors, website]
---

# JS-first token runtime — slice 3: migrate we:src/css/style.css :root vars onto the emitted set

The WE-locus migration slice of #1683. The WE docs site hand-authors its design tokens as `:root` custom properties in `we:src/css/style.css` (the `--color-*` / `--spacing-*` / `--radius-*` / `--shadow-*` / `--font-*` families). Once slices 1 (#1811, injector theme SoT) and 2 (#1812, one-way CSS emit) land in FUI, migrate those hand-authored `:root` vars onto the injector-emitted set so the site's tokens come from the one source (no parallel hand-authoring), consuming the FUI runtime per the constellation import pattern.

## Acceptance
- `we:src/css/style.css` no longer hand-declares the token `:root` vars that the injector now emits; the site renders identically (no visual diff).
- Removing/renaming a token at the source updates the site's CSS var via the emit, not a hand edit.
- `check:standards` green; `eleventy` build clean.

## Pre-flight (batch-20260626-1811-1817-1819) — "constellation import pattern" hides a real fork → cascade broke here

Slices 1 (#1811) + 2 (#1812) landed in FUI (`fui:plugs/webtheme/`: `ThemeSource` + `emitTokenCss`/`applyTokenVars`). But this WE-locus slice is **not** a clean mechanical migration — the body's "consuming the FUI runtime per the constellation import pattern" is treated as settled when two calls are open:
1. **How a static docs site gets the emitted `--token-*` CSS without FOUC.** WE's Eleventy build **cannot** `import '@frontierui'` (the #700/#239 WE→FUI build-import ban). A runtime cross-origin `import()` + `applyTokenVars` injects `:root` vars *after* first paint → FOUC, which violates this item's own "renders identically / no visual diff" acceptance. So the emit must be **build-time static CSS**, which needs a path WE can consume without a build-time FUI import: a FUI-build-emitted-and-served stylesheet WE references vs a published-artifact read (the #700/#907 end-state). That transport choice is undecided — same bucket as the #1618 / author-mode transport fork.
2. **Where the WE site's specific token *values* live.** The source is FUI's `defaultTheme`; the site's brand values currently live in `we:src/css/style.css`. Per the three-layer carve (config→WE, impl→FUI, values→product) the site's values should be a **project theme extending the FUI default** — but no "WE-site project theme" mechanism is wired yet.

Both are design calls, not wiring. Left `open` — needs `/prepare` (or a `kind: decision` for the static-site token-CSS transport + project-theme home) before it's a clean migration. Slices 1/2 are unaffected and shipped.

> **Confirmed + encoded (batch-2026-06-26-1813-1208-1618).** Verified the fork against the tree: the build-import ban is explicit at `we:src/_layouts/base.njk:434` ("NEVER a build-time `import '@frontierui'`"), and the FUI emit (`fui:plugs/webtheme/emitCss.ts`) only reaches WE via runtime cross-origin import → FOUC. The undecided transport + project-theme home is now filed as decision **#1824**; re-pointed `blockedBy: ["1811","1812"] → ["1824"]` (slices 1/2 resolved, so the real blocker is the decision, not the prose note). Declined from the batch as `not-batchable` (fork).
