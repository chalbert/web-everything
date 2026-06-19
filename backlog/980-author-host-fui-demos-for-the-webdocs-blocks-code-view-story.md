---
type: idea
workItem: story
size: 3
parent: "972"
locus: frontierui
status: resolved
dateOpened: "2026-06-18"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "fui:demos/webdocs-blocks-demo.html"
tags: []
---

# Author + host FUI demos for the webdocs blocks (code-view, story-canvas, props-table)

Author #813-pattern runtime demos in fui:demos/ for code-view, story-canvas and props-table, then set demoFile on each fui:src/_data/blocks.json entry so #971's slot renders them. Slice of #972; locus frontierui.

## Progress — done in batch-2026-06-18

Authored `fui:demos/webdocs-blocks-demo.html` (reuses `fui:demos/playground.css`), three live custom-element
sections, each registered then fed via its property API:
- **code-view** — `registerCodeView()`; `<code-view language="ts">` with `.code` set to a TS snippet
  (highlighted source + copy).
- **story-canvas** — `registerStoryCanvas()`; `.case = { id, title, description, code }` renders one WebCase
  in isolation (#626 — docs examples *are* webcases).
- **props-table** — `registerPropsTable()`; `.declaration = {…CEM…}` renders the attributes + members of a
  CEM custom-element declaration as a reference table.

Wired `demoFile` → `fui:demos/webdocs-blocks-demo.html` on all three blocks + cleared them from
`DEMO_PENDING` (`fui:scripts/check-standards.mjs`, #973). **Playwright-verified on :3001**: code-view shows
the snippet, story-canvas renders the case, props-table emits 8 rows incl. the `label` attribute, 0 console
errors. FUI check:standards green.
