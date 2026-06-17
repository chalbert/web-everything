---
type: issue
workItem: story
size: 2
status: resolved
dateOpened: "2026-06-17"
dateStarted: "2026-06-17"
dateResolved: "2026-06-17"
graduatedTo: src/sitemap.njk
tags: []
---

# Author sitemap.njk over collections.all (emit /sitemap.xml)

Per #774 Fork-2=A: author an 11ty template src/sitemap.njk that paginates collections.all and emits /sitemap.xml from 11ty's complete page knowledge. No sitemap exists today (/sitemap.xml 404s). This is the single source of truth the rendered-site a11y gate (#770) will parse for its route list, and doubles as the missing SEO sitemap. Standard site artifact (sitemaps.org), no protocol minted.

## Progress (2026-06-17, batch-2026-06-17) — built

- **Template:** [src/sitemap.njk](../src/sitemap.njk) — iterates `collections.all`, emits a sitemaps.org/0.9 `<urlset>` at `/sitemap.xml` (each page → `<loc>` + optional `<lastmod>` from `page.date`). `eleventyExcludeFromCollections: true` keeps the sitemap out of itself; the `entry.url.endsWith("/")` guard keeps the two redirect templates (which set `eleventyExcludeFromCollections`) and any non-directory output off the list.
- **Completeness fix:** Eleventy adds only the *first* page of each paginated template to `collections.all` by default, so a naive sitemap held 50 URLs (missing all 76 blocks, all intents, ~840 backlog pages). Added `addAllPagesToCollections: true` to the 12 content detail-page templates' `pagination:` block (adapter/backlog/block/capability/capability-adapter/demo/intent/plug/project/research-topic/resource/state-pages.njk) — **not** the 2 `*-redirects.njk` (those stay excluded). `collections.all` has no other consumer (only this template iterates it), so the semantics change is contained. Result: **1274** balanced URLs.
- **Base origin:** [src/_data/site.js](../src/_data/site.js) — `site.url` for absolute `<loc>`, default `https://webeverything.dev`, override via `SITE_URL=…` at build. The #770/#774 gate strips it to a pathname; only SEO cares about the host.
- **Proxy:** added `sitemap.xml` to the Vite dev-proxy allowlist alternation ([vite.config.mts:120](../vite.config.mts#L120)) so it serves on :3000 too (check:standards §9 catalog-route coverage).
- **Verified:** `npx @11ty/eleventy` writes `_site/sitemap.xml` (1274 `<loc>`, balanced `<url>` tags, ns declared, closes clean); live `:8080` → 200, `:3000` proxy → 200; `check:standards` 0 errors for this changeset.
