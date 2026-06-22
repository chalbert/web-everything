---
kind: story
size: 3
parent: "1485"
locus: frontierui
status: resolved
blockedBy: ["1510"]
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: "fui:blocks/dockable/renderDockable.ts"
tags: []
---

# FUI dockable recursive container render — row/column/stack via Grid/Flex + recursive resizable splits

Slice of #1485 (locus:frontierui): render the dockable partition tree — recursive row/column/stack nodes via CSS Grid/Flex, recursive resizable linear-split dividers (reflow siblings, no collision), tab-stack leaves via the tabs block, and the fixed APG Window Splitter a11y invariant on every divider. Static tree renders + dividers resize. blockedBy #1510 (contract).
