---
type: issue
workItem: story
size: 3
parent: "658"
status: open
dateOpened: "2026-06-15"
tags: []
---

# Create @frontierui/blocks as a canonical FUI workspace sub-package

S1 of #658. Create @frontierui/blocks as a granular FUI workspace sub-package (sibling of the future @frontierui/plugs): a package.json + exports map covering the 14 families FUI already owns (attributes, droplist, for-each, navigation, parsers, renderers, resource-loader, router, stores, tabs, text-nodes, traits, transient, view), add "blocks" to the root workspaces array (the existing top-level compiler precedent — blocks/ stays at FUI root, not under packages/), and wire build. FUI-only — no WE change, no delete. Executes Fork 2 of the #641 ruling.
