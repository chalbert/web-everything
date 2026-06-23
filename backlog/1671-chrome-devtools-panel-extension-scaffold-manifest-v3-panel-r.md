---
kind: story
size: 3
parent: "1656"
locus: plateau-app
status: resolved
dateOpened: "2026-06-23"
dateStarted: "2026-06-23"
dateResolved: "2026-06-23"
graduatedTo: "plateau:src/dev-browser/chrome-extension/"
tags: [dev-browser, chrome-extension, plateau]
---

# Chrome DevTools-panel extension scaffold — Manifest V3 + panel registration + background service-worker

The dev-browser funnel-MVP chassis (#1656 S1): a Manifest V3 Chrome extension that registers a Web Everything DevTools panel and a background service-worker, homed in plateau:src/dev-browser/chrome-extension/. Reuses the DevTools-panel surface settled by the #1656 title + #141/#1654 DevTools framing. Demoable: load unpacked, a Web Everything panel appears in DevTools on any page. Fork-free chassis — the lights-up-on-conformance behavior is held behind the conformance-detection decision.

## Progress (resolved 2026-06-23, batch-2026-06-23-1689-1500)

Scaffolded in `plateau:src/dev-browser/chrome-extension/` as plain static assets (load-unpacked, no
bundler):

- **the MV3 manifest** — `manifest_version: 3` with a `devtools_page` + a `background.service_worker`.
- **the DevTools page + script** — the DevTools-context page registers the panel via
  `chrome.devtools.panels.create('Web Everything', …, panelPage)` so the panel appears in DevTools on any
  inspected page.
- **the panel page + script** — the panel surface + a `data-role="status"` slot (the chassis the
  conformance-detection slice fills); the script stamps the inspected tab id to confirm mount.
- **the background service-worker** — minimal MV3 (`onInstalled` hook) — the message-hub entry point later
  slices use.
- **a README** — load-unpacked instructions + the file table.
- **the test** — 5 tests: MV3 manifest shape, devtools+service-worker registration, every referenced file
  exists, the panel is registered under "Web Everything", the panel page loads its script.

Fork-free: no conformance detection — that lights-up behaviour stays held behind the conformance-detection
decision (a later #1656 slice). The script assets are Chrome-loaded (not bundled/typechecked by plateau's
vite/tsc, which only touch `plateau:src/**/*.ts`).
