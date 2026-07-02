---
kind: story
size: 3
status: resolved
dateOpened: "2026-07-02"
dateStarted: "2026-07-02"
dateResolved: "2026-07-02"
graduatedTo: none
relatedProject: webcomponents
tags: [docs-site, dogfood, reference-implementation, webtheme]
---

# FUI docs-site should dogfood the library it showcases

The FUI Eleventy docs-site renders zero FUI components — fui:src/_layouts/base.njk loads no script at all, and its chrome is a standalone 479-line stylesheet disjoint from fui:webtheme/. A reference-implementation library's own docs are the cheapest dogfood surface: render the catalog pages with FUI blocks (e.g. card, navigation, code-view, props-table) themed by webtheme, so the site exercises the library it documents. Surfaced by the #2053 discussion (ruling: co-locate, conditioned on clean separation) — dogfooding strengthens co-location while keeping the site surface under fui:src/.

## Resolution (2026-07-02)

Implemented entirely in the FUI repo (this WE item carries only the tracker state — WE holds zero implementation). The docs-site now renders its block catalog with the library's own `card` block, themed by `webtheme`:

- **fui:scripts/build-site.mjs** — run by an `eleventy.before` hook, esbuild-bundles fui:src/_bootstrap/site-blocks.ts → fui:_site/assets/site-blocks.js (registers `we-card`), and `compileToCss(defaultTokens)` + the card block's `CARD_CSS` → fui:_site/css/webtheme.css. The site's theme *is* the library's webtheme token compile, so it can't drift from fui:webtheme/.
- **fui:src/_layouts/base.njk** loads both artifacts; **fui:src/index.njk**'s "Available Blocks" grid is now real `<we-card>` elements (upgrade to `<article class="fui-card block-card">`); `.block-card` layers the docs grid/hover chrome. Progressive enhancement: with JS off the un-upgraded element still shows its content as flow text.
- **Clean separation (#2053 ruling):** fui:src/ imports *from* the library dirs (fui:blocks/, fui:webtheme/); the library never imports from fui:src/. Generated output lives only under fui:_site/.
- **Regression guard:** fui:scripts/__tests__/build-site.test.ts asserts both artifacts emit with their load-bearing content (we-card registration; `:root` tokens + `.fui-card` CSS).

Verified: eleventy build emits both assets; Playwright confirmed all 63 catalog `we-card`s upgrade with no console/page errors; FUI `check:standards` green. First real dogfood surface — a further pass could extend to `navigation`/`code-view`/`props-table` (kept out of scope here to stay proportionate).
