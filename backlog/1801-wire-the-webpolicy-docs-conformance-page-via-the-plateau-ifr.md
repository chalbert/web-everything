---
kind: story
size: 2
parent: "1294"
status: open
blockedBy: ["1800"]
dateOpened: "2026-06-26"
tags: []
---

# Wire the webpolicy docs conformance page via the plateau iframe

Repoint we:demos/webpolicy-conformance-demo.ts to render webpolicy conformance pass/fail through the plateau-hosted conformance iframe (#1790/#1788 (b)) running the webpolicy vector suite against the FUI binding — replacing the bespoke in-page asserts. The visible plateau-origin docs surface for webpolicy. Blocked on the binding + vectors (W2).
