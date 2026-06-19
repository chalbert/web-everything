---
type: issue
workItem: story
size: 3
status: resolved
dateOpened: "2026-06-17"
dateStarted: "2026-06-17"
dateResolved: "2026-06-17"
graduatedTo: src/build-id.njk
tags: []
---

# Dev-server staleness detector: build-id over HTTP + stale banner

The dev docs server (Eleventy :8080) can crash or rebuild-fail while the browser keeps showing the last-built HTML, so authors silently read stale docs (the recurring cache/stale-tab/crash confusion — #610). Add a freshness signal: Eleventy writes a we:build-id.json (timestamp + git sha) each build and stamps the same id into a base-layout meta tag; a tiny injected client script polls we:build-id.json every few seconds and shows a red 'STALE — server down or page outdated' banner when the id drifts or the fetch fails.

Expose the same check as an agent-usable HTTP probe (GET we:build-id.json, compare) so verification doesn't depend on a human noticing. Cheap: localhost GET is ms; validate one token, not full content. Pairs with the npm-run-dev self-heal change (drop --kill-others + concurrently restart flags) already applied.

## Progress (2026-06-17, batch-2026-06-17) — built

- **Build identity:** [we:src/_data/buildId.js](../src/_data/buildId.js) — global data computed once per 11ty build (re-run on every `--serve` rebuild): `{ id: "<sha>-<iso-time>", sha, time }`. [we:src/build-id.njk](../src/build-id.njk) emits it at `we:/build-id.json` (`eleventyExcludeFromCollections` so it stays out of the #846 sitemap).
- **Page stamp:** [we:src/_layouts/base.njk](../src/_layouts/base.njk) head carries `<meta name="build-id" content="{{ buildId.id }}">` — the build a given tab was loaded from.
- **Client poller:** [we:src/assets/js/staleness-detector.js](../src/assets/js/staleness-detector.js) (wired into we:base.njk) reads the meta id and polls `we:/build-id.json` every 4s; raises a fixed red `role="alert"` banner with a Reload button when the served id drifts (newer build exists → outdated tab) or the fetch fails (server down). No-op without the meta tag.
- **Agent probe:** [we:scripts/dev/check-fresh.mjs](../scripts/dev/check-fresh.mjs) (`npm run check:fresh`, `--json`/`--url=` flags) — GETs we:build-id.json and exits 0 fresh / 1 stale (served sha ≠ git HEAD) / 2 down, so verification doesn't depend on a human noticing.
- **Proxy:** added `we:build-id.json` to the Vite dev-proxy allowlist ([vite.config.mts:120](../vite.config.mts#L120)) so :3000 serves it too.
- **Verified:** `npx @11ty/eleventy` emits `we:_site/build-id.json`; page meta id === json id; live `:8080` + `:3000` proxy both 200; `check:fresh` → FRESH (exit 0) against the running server, DOWN (exit 2) against a dead port; Playwright smoke on `/` → meta stamped, **no** spurious banner after a poll cycle, zero console errors; `check:standards` 0 errors for this changeset.
