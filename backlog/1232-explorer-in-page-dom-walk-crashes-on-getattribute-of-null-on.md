---
type: issue
workItem: story
size: 3
locus: frontierui
status: open
dateOpened: "2026-06-20"
crossRef: { url: /backlog/1219-explorer-cli-npm-script-run-the-autonomous-stress-test-gate-/, label: "#1219 explorer CLI — surfaced this while smoke-testing the gate" }
tags: [fui-devtool, exploratory-testing, bug]
---

# Explorer in-page DOM walk crashes on getAttribute of null on rich pages

The explorer's in-page structural walk (`fui:tools/explorer/domSignature.ts` / `fui:tools/explorer/playwrightDriver.ts`, run via `page.evaluate`) throws `TypeError: Cannot read properties of null (reading 'getAttribute')` (in `walk`) on a rich real page — reproduced by `npm run explore:gate -- / ` against the FUI docs root on `:8082`/`:3001`. Bounded demo pages (e.g. the `fui:demos/anchored-resize.html` route) walk fine; the homepage's DOM hits a node whose `getAttribute` is null (likely a non-Element node — text/comment/doctype — reached by the child traversal without a `nodeType === ELEMENT_NODE` guard). Add the element-node guard in the in-page `walk` so the signature ignores non-Element children. Surfaced by #1219's CLI smoke (the CLI itself works + reports the crash cleanly); this is an explorer-core (#1168) fix, not a CLI fix.
