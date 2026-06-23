---
kind: decision
parent: "1656"
locus: plateau-app
status: open
dateOpened: "2026-06-23"
tags: [dev-browser, conformance, monetization, chrome-extension, decision]
---

# Conformance-lit MVP — how does the extension detect WE-conformance of a live page?

The buried fork at the heart of #1656, carved out so no build slice silently picks it. How does the dev-browser extension decide a running page is WE-conformant (and so lights its tooling up)? No live-page probe exists today. Three materially different, mutually-exclusive end-states: (a) DECLARED — the app ships a CapabilityManifest (the we:capability-manifest/ schema) the extension reads; (b) PROBED — the extension inspects the live runtime for WE signals (custom-element registry, the webexpressions binding layer, context providers), needing no app cooperation; (c) VERIFIED — run conformance vectors/the engine against the live page. The choice defines what the funnel's first impression means. Resolving this unblocks the held probe / not-WE-compatible screen / lit-gating slices under #1656. Parallels #1654/#1655 off the #1391 analysis.
