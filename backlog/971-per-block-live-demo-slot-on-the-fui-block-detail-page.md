---
type: idea
workItem: story
size: 3
parent: "970"
locus: frontierui
status: resolved
dateOpened: "2026-06-18"
dateStarted: "2026-06-18"
dateResolved: "2026-06-18"
graduatedTo: "fui:src/block-pages.njk"
tags: []
---

# Per-block live-demo slot on the FUI block detail page

Add a 'Try it live' demo slot to fui:src/block-pages.njk, driven by an optional demoFile field on each fui:blocks.json entry (FUI-side mirror of WE's #727 slot). Render a sandboxed iframe to fui:demos/<file> when a block carries demoFile; omit cleanly when absent. Wire the ~15 blocks whose demo already exists in fui:demos/ (data-grid→data-grid-demo, background-task-surface→background-task-surface-demo, for-each→for-each-demo, tabs→view-tabs-demo, interpolation-text-node→text-interpolation-demo, nav-list→navigation-demo, droplist→autocomplete-unplugged, etc.). Mapping lives on fui:blocks.json (the FUI site is data-driven), per #727's field convention — NOT the per-partial .njk pattern #733 chose for the WE side. The remaining demo-less blocks are #972; the completeness gate is #973.

## Progress — done in batch-2026-06-18

- **Locus fix:** added `locus: frontierui` (item was mis-flagged with no locus though every ref is `fui:`).
- **Slot:** added a `{% if block.demoFile %}` "Try it live" section to fui:src/block-pages.njk — a sandboxed
  same-origin `<iframe src="/demos/{{ block.demoFile }}">` (FUI demos are same-origin, so a plain sandboxed
  iframe, not WE's cross-origin `fuiDemo` shortcode). Omits cleanly when `demoFile` is absent.
- **Mapping:** wired **11** verified block→demo pairs as a `demoFile` field on fui:src/_data/blocks.json:
  data-grid, background-task-surface, for-each, tabs (view-tabs-demo), interpolation-text-node
  (text-interpolation-demo), nav-list (navigation-demo), droplist (autocomplete-unplugged) — the 7 the body
  named — plus 4 confirmed by title+summary: router→declarative-spa-router, guard→visibility-gate,
  temporal→datetime-picker, rich-text-editor→`rich-text-editor/` (subdir demo, served at `/demos/rich-text-editor/`).
  Ambiguous candidates (view, type-ahead, app-shell, sectioned-nav, disclosure-nav, the bracket parsers) were
  **left to #972** rather than mis-wired — a wrong iframe is a broken demo.
- **Verified on live :3001:** data-grid renders the slot + iframe (`/demos/data-grid-demo.html` → 200);
  wizard (unwired) renders no slot; rich-text-editor resolves the subdir path (→ 200). FUI check:standards green.
