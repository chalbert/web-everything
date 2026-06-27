---
kind: story
size: 8
parent: "1683"
status: open
locus: webeverything
blockedBy: []
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

Both were design calls, not wiring — **now resolved by decision #1824 (ratified 2026-06-27)**; the concrete migration scope is in the "Unblocked by #1824" section below. Slices 1/2 are unaffected and shipped.

> **Confirmed + encoded (batch-2026-06-26-1813-1208-1618).** Verified the fork against the tree: the build-import ban is explicit at `we:src/_layouts/base.njk:434` ("NEVER a build-time `import '@frontierui'`"), and the FUI emit (`fui:plugs/webtheme/emitCss.ts`) only reaches WE via runtime cross-origin import → FOUC. The undecided transport + project-theme home is now filed as decision **#1824**; re-pointed `blockedBy: ["1811","1812"] → ["1824"]` (slices 1/2 resolved, so the real blocker was the decision, not the prose note). Declined from that batch as a fork at the time; **the fork is now resolved (#1824 ratified) and `blockedBy` cleared** — see the concrete scope below.

## Unblocked by #1824 (ratified 2026-06-27) — concrete scope + re-size

Decision #1824 resolved both calls. This story now carries three pieces (re-sized `3 → 8`):

> **Analyzed 2026-06-27 (`/slice 1813`): atomic — keep whole, do not slice.** The three pieces are a
> rigid linear chain (P2→P1→P3): `ThemeSource.with()`/`emitTokenCss()` both live in FUI and WE can't
> build-import them, so P1+P2 resolve FUI-side and only the `:root{}` string crosses — nothing visible
> ships until P3 (no incremental delivery), and P1 still carries #1824's "ruled at build" transport
> residual. Already at the `size:8` batchable ceiling; work it as one pass. See
> [the split analysis](../reports/2026-06-27-backlog-split-analysis.md).
1. **Engine-agnostic transport (Fork 1a).** A thin `we:src/_data/` build global returns the FUI
   `emitTokenCss()` `:root{}` string fresh each build (bytes cross via the #1731 served-route/CLI
   boundary — **no** build-import, **no** committed generated artifact); the layout inlines it
   server-side into `we:src/_layouts/base.njk` head pre-paint (no FOUC). Keep the transport
   engine-agnostic so an eventual move off Eleventy re-points one sink (see #1824's ruling + #777).
2. **WE-site project theme (Fork 2a).** Author a WE-owned override (the existing light `--color-*`
   values + the names FUI's dark default lacks) consumed by `ThemeSource.with()` over the FUI
   default; emit *that resolved theme* as `--token-*`. Residual ruled at build: override home is a
   WE `_data` module vs a TS theme module.
3. **Alias bridge (Fork 2a sub-fork).** One generated block aliases the legacy `--color-*` names to
   the emitted `--token-*` (`--color-primary: var(--token-color-primary)`) so the 629 `we:src/`
   call sites keep working *and* now derive from the injector — satisfying this story's "renaming a
   token at source updates the site's var" acceptance with near-zero churn (full call-site rename is
   a later cleanup, not this slice).
