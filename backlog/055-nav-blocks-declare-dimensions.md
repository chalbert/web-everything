---
type: idea
workItem: task
status: open
dateOpened: "2026-06-03"
tags: [navigation, intent, tabs, nav-list, blocks, vocabulary, propagation]
relatedReport: reports/2026-06-03-navigation-intent-vocabulary.md
relatedProject: webblocks
crossRef:
  url: /intents/navigation/
  label: Navigation Intent
---

# Propagate the expanded Navigation vocabulary into implementing blocks

The Navigation Intent grew from one dimension to six (`structure`, `history`, `scroll`, `transition`, `guard`, `persistence`). The blocks that already declare `implementsIntent: "navigation"` — [tabs](/blocks/tabs/) and [nav-list](/blocks/nav-list/) — predate the new axes and still declare only their IA `structure`. They should declare the values they realize: e.g. tabs as `structure: lateral`, `history: none` (or `replace`), `scroll: preserve`, and a `persistence` choice (is the active tab in the URL?). [router](/blocks/router/) already maps cleanly (`scroll`/`transition`/`route:guard:leave`/Navigation-API `history`) but its `.njk` could surface the vocabulary explicitly.

Low-risk refinement, not a gap that breaks anything — the intent is the source of truth and the blocks remain conformant. Do this once the three open decisions (persistence value set, transition↔motion precedence, focus-reset home) settle, so the blocks declare against a finalized vocabulary.
