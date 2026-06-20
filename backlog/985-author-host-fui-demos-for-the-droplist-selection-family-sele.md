---
kind: story
size: 3
parent: "972"
locus: frontierui
status: resolved
dateOpened: "2026-06-18"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "fui:demos/droplist-selection-demo.html"
tags: []
---

# Author + host FUI demos for the droplist/selection family (selection, tree-select, type-ahead)

Author runtime demos for selection, tree-select and type-ahead (the droplist family per #064) in fui:demos/ and wire demoFile. Slice of #972; locus frontierui.

## Progress — done in batch-2026-06-18

Authored `fui:demos/droplist-selection-demo.html` (reuses `fui:demos/playground.css`), three live sections
over plain ARIA markup:
- **selection** — `new SelectionBehavior(listbox, { itemSelector: '[role=option]', model: 'multiple', onChange })`;
  click rows to multi-select, live read-out of selected labels.
- **tree-select** — `new TreeSelectBehavior(host, nodes, { model: 'multiple', cascade: true, defaultExpanded: true, onChange })`;
  builds a `role="tree"` from a 2-level node config, cascading checks.
- **type-ahead** — declarative `type-ahead` attribute on a listbox, registered via `registerTypeAhead(new CustomAttributeRegistry())`
  then `.upgrade()`; press a letter to jump focus.

Wired `demoFile` on all three blocks + cleared them from `DEMO_PENDING` (`fui:scripts/check-standards.mjs`,
#973). **Playwright-verified on :3001**: selection → "React, Svelte"; tree renders 6 nodes; type-ahead "b"
focuses Brazil; 0 console errors. FUI check:standards green.
