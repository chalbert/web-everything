---
type: idea
workItem: story
size: 2
parent: "972"
locus: frontierui
status: resolved
dateOpened: "2026-06-18"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "fui:demos/view-event-behaviors-demo.html"
tags: []
---

# Author + host FUI demos for view & event-behaviors

Author runtime demos for view (show/hide ViewEngine) and event-behaviors (declarative on:click mapping) in fui:demos/ and wire demoFile. Slice of #972; locus frontierui.

## Progress — done in batch-2026-06-18

Authored `fui:demos/view-event-behaviors-demo.html` (reuses `demos/playground.css`), two live sections:
- **view** — drives a panel through `ViewEngine.show()/hide()/toggle()` with a selectable hidden mode
  (`content-visibility`/`display`/`until-found`/`inert`); state read-out updates live.
- **event-behaviors** — a counter wired purely by declarative `on:click="increment($event)"` attributes;
  handlers provided via `customContexts:handlers` on the document injector, then `attributes.upgrade(document.body)`
  (the bootstrap pre-registers the `on:*` definitions; the explicit upgrade after the handler context is set
  mirrors `demos/declarative-spa.html`).

Wired `demoFile` on both blocks in `fui:src/_data/blocks.json` + removed them from `DEMO_PENDING`
(`fui:scripts/check-standards.mjs`, #973). **Playwright-verified on :3001**: `on:click` counter reaches 2
after +3/−1, view state toggles hidden/visible, 0 console errors. FUI check:standards green.
