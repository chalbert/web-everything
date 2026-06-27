---
kind: decision
parent: "1683"
status: open
dateOpened: "2026-06-27"
tags: []
---

# Static-site token-CSS transport: how WE's Eleventy build consumes the FUI-emitted token CSS without a build-import or FOUC

Blocks **#1813** (re-pointed `blockedBy: ["1824"]`). FUI slices 1 (#1811) + 2 (#1812) shipped the injector + one-way CSS emit (`fui:plugs/webtheme/emitCss.ts`, `fui:plugs/webtheme/ThemeSource.ts`, `fui:plugs/webtheme/defaultTheme.ts`). #1813 is the WE-locus migration of `we:src/css/style.css`'s hand-authored `:root` token vars onto that emitted set — but it is **not** clean wiring, because two consumption calls are open.

## What you decide

**1. Build-time transport.** WE's Eleventy build **cannot** `import '@frontierui'` — the #700 WE→FUI build-import ban, documented at `we:src/_layouts/base.njk:434` ("NEVER a build-time `import '@frontierui'`"); WE consumes FUI only via runtime cross-origin import (mode C). But a runtime `import()` + `applyTokenVars` injects the `:root` vars *after* first paint → **FOUC**, which violates #1813's own acceptance ("the site renders identically — no visual diff"). So the emit must reach the page as **build-time static CSS** WE can `<link>` without a build-import. Branches:
- **A — FUI-served / build-emitted stylesheet.** FUI emits the token CSS as a deployable asset (the same served-route family as the #1731/#1752 author-mode `/_maas/` route); WE references it via a build-time `<link>`. No build-import, no FOUC.
- **B — Published-artifact read.** WE reads a published FUI token-CSS artifact at build time (the #700/#907 published-package end-state).

**2. Where the WE-site's token VALUES live.** The emit's source is FUI's default theme; the site's brand values currently live in `we:src/css/style.css`. Per the three-layer carve (contract→WE, impl→FUI, values→product) the site's values should be a **project theme extending the FUI default** — but no "WE-site project theme" mechanism is wired yet. Decide whether slice 3 establishes that home or consumes the FUI default verbatim for now.

No default set — **unprepared** (Tier B: discuss, don't auto-build). `/prepare` to bring bold defaults to DoR. Verified in batch-2026-06-26-1813-1208-1618 (ban + FOUC confirmed against the tree); diagnosis originally surfaced by batch-20260626-1811-1817-1819. Relates to [[project_theme_tokens_js_first]] (#1682) and the author-mode transport fork (#1731/#1752).
