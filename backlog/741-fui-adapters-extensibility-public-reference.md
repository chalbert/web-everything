---
type: issue
workItem: story
size: 2
parent: "723"
locus: frontierui
status: resolved
dateOpened: "2026-06-16"
dateStarted: "2026-06-16"
dateResolved: "2026-06-16"
tags: []
---

# FUI adapters / extensibility public reference

The webdocs ingestion adapters (storybook, mintlify) are undocumented publicly; add an extensibility/adapters reference page. From the #723 audit.

## Progress

- Added `fui:src/adapters.njk` — public Adapters & Extensibility reference: the `IngestionAdapter` contract, the two built-in adapters (storybook/CSF, mintlify/MDX), and a "drop in your own sibling module" guide.
- Added an "Adapters" nav entry in `we:src/_layouts/base.njk` (after Plugs).
