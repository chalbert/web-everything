---
type: issue
workItem: story
size: 3
locus: frontierui
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "fui:tools/explorer/playwrightDriver.ts"
crossRef: { url: /backlog/1219-explorer-cli-npm-script-run-the-autonomous-stress-test-gate-/, label: "#1219 explorer CLI — surfaced this while smoke-testing the gate" }
tags: [fui-devtool, exploratory-testing, bug]
---

# Explorer in-page DOM walk crashes on getAttribute of null on rich pages

The explorer's in-page structural walk (`fui:tools/explorer/domSignature.ts` / `fui:tools/explorer/playwrightDriver.ts`, run via `page.evaluate`) throws `TypeError: Cannot read properties of null (reading 'getAttribute')` (in `walk`) on a rich real page — reproduced by `npm run explore:gate -- / ` against the FUI docs root on `:8082`/`:3001`. Bounded demo pages (e.g. the `fui:demos/anchored-resize.html` route) walk fine; the homepage's DOM hits a node whose `getAttribute` is null (likely a non-Element node — text/comment/doctype — reached by the child traversal without a `nodeType === ELEMENT_NODE` guard). Add the element-node guard in the in-page `walk` so the signature ignores non-Element children. Surfaced by #1219's CLI smoke (the CLI itself works + reports the crash cleanly); this is an explorer-core (#1168) fix, not a CLI fix.

## Resolved 2026-06-20 (batch-2026-06-20-1232-1220-1221) — element-node guard added; crash did NOT reproduce on current code

Hardened the in-page `walk` in `fui:tools/explorer/playwrightDriver.ts` (`snapshot()`): it now skips any null / non-Element `el` (`nodeType !== ELEMENT_NODE → return null`, recursion filters nulls) and a still-null `document.body` degrades to a bare `{ tag: 'html' }` instead of throwing. The walk never aborts the explore on a node whose `getAttribute` is null.

**Honest correction to the report's diagnosis:** the crash did **not** reproduce on the current code. The walk uses `el.children` (HTML-element-only — there is no `childNodes` traversal anywhere in `tools/explorer/`), so the reported "non-Element child" path can't occur; the only null-`el` path is the ROOT, `walk(document.body)`, when `document.body` is momentarily null on a rich page snapshotted mid-navigation (a candidate click that starts a fresh document). Two full `explore:gate` runs (`:3001` and the richer `:8082` assembled-docs homepage) each explored 38+ states cleanly with no `getAttribute` throw. So the fix is a **hardening of that real null path** (verified no regression — the explorer still explores the full state set post-guard), not a reproduction-confirmed line fix. `fui:tools/explorer/domSignature.ts` needed no change (its `serializeNode` is pure over the already-built snapshot).
