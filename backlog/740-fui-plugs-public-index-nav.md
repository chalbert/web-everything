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

# FUI plugs public index + nav

9 plug domains (plugs/web*) have no public index describing each; add a plugs index page + nav. From the #723 audit.

## Progress

- Added `src/_data/plugs.json` (9 plug domains: 8 web* + core, each id/name/type/status/summary).
- Added `src/plugs.njk` index/catalog page mirroring the blocks.njk grid pattern.
- Added a "Plugs" nav entry in `src/_layouts/base.njk` (between Blocks and About).
