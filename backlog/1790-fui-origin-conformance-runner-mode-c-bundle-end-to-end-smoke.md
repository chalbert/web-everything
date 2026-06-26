---
kind: story
size: 5
parent: "1783"
status: open
blockedBy: ["1788"]
dateOpened: "2026-06-26"
tags: []
---

# FUI-origin conformance-runner mode-C bundle + end-to-end smoke proof

Stand up the headless-logic surface path: a FUI-origin mode-C bundle (mountInDocument, per fui:embed/chrome-in-document.ts) exposing the generic conformance runner so the WE docs site can run a synchronous vector suite against a FUI binding and display pass/fail. Includes an end-to-end smoke proof with a trivial synchronous example vector + reference binding (NOT webpolicy — that arrives with #1294). Blocked on #1788 (the runner's home must be resolved so the bundle is FUI-origin without a FUI→plateau backward edge).
