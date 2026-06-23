---
kind: story
size: 3
parent: "1656"
locus: plateau-app
status: open
dateOpened: "2026-06-23"
tags: [dev-browser, chrome-extension, plateau]
---

# Chrome DevTools-panel extension scaffold — Manifest V3 + panel registration + background service-worker

The dev-browser funnel-MVP chassis (#1656 S1): a Manifest V3 Chrome extension that registers a Web Everything DevTools panel and a background service-worker, homed in plateau:src/dev-browser/chrome-extension/. Reuses the DevTools-panel surface settled by the #1656 title + #141/#1654 DevTools framing. Demoable: load unpacked, a Web Everything panel appears in DevTools on any page. Fork-free chassis — the lights-up-on-conformance behavior is held behind the conformance-detection decision.
