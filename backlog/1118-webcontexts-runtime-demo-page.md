---
type: idea
workItem: task
parent: "1091"
status: resolved
blockedBy: ["1117"]
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "we:demos/webcontexts-demo.html"
tags: []
---

# webcontexts: runtime demo page

Scaffold we:demos/webcontexts-demo.{html,ts,css} (none exists) exercising declarative `<script type=context>`, claim-based fallback, and a strict/flexible toggle in a real browser; wire into the demo registry per the new-demo skill. Demo: the page renders on the Vite demo server.

## Progress (resolved 2026-06-19)

Scaffolded the single-file playground per the new-demo skill:
- **we:demos/webcontexts-demo.html** — shell loading the unplugged `.ts`; mode + query toggle controls + a live resolution readout.
- **we:demos/webcontexts-demo.ts** — applies the webcontexts + webinjectors patches itself (unplugged/non-invasive), builds a parent+child scoped injector tree with same-typed `profile` contexts (child `UserContext` claims only `user.*`, parent `AppContext` claims all), registers the child declaratively via a scoped `CustomContextRegistry` + a `<script type="context" context="profile">` element, and badges 5 invariants: declarative recognition, strict→closest (claim ignored), flexible→defers a declined query up-chain, flexible→child when it claims, default mode flexible (#911). A live mode/query `change` listener re-resolves via `resolveContext(...)`. Exposes `window.playgroundReady`/`playgroundPass` for E2E.
- **we:demos/webcontexts-demo.css** — control bar + readout styling over the shared we:demos/playground.css harness.
- **we:src/_data/demos/webcontexts-demo.json** — registry entry (per-entry file since #1146; projects `webcontexts`/`webinjectors`, both resolve).

Verified live on the running Vite :3000 server with a headless browser: page renders, `window.playgroundReady === true`, `window.playgroundPass === 5` (all invariants), zero console/page errors. Gates green: `check:demos` 0 errors, whole-repo `check:standards` 0 errors.
