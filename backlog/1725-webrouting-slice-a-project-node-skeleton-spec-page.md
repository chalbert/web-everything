---
kind: task
parent: "1684"
status: resolved
dateOpened: "2026-06-24"
dateStarted: "2026-06-24"
dateResolved: "2026-06-24"
graduatedTo: 1684
tags: []
---

# webrouting slice A — project node + skeleton spec page

First scaffold slice of the webrouting standard (epic #1684): stand up the project node we:src/_data/projects/webrouting.json + spec page we:src/_includes/project-webrouting.njk + we:assets/icons/webrouting.svg so the tile renders at /projects/webrouting/, and add relatedProject: webrouting to the router block (we:src/_data/blocks/router.json). Root slice — B/C build on it. Mirrors webgraph slice #1372.

## Progress (batch-2026-06-23-1725-1665)

Slice A landed — the webrouting project node + skeleton spec page are live:

- `we:src/_data/projects/webrouting.json` — project node (status `concept`, category `standard`), so the tile renders at `/projects/webrouting/`.
- `we:src/_includes/project-webrouting.njk` — skeleton spec page: Mission, Scope (3 planes: route-format profile / URL-as-state seam / sitemap derivation), and a Route-format source-of-truth section grounding the #1685 ratification (declarative-DOM `<template route>` is the authoring SoT; URLPattern is the grammar; a serializable route-map projection is *derived* for non-DOM consumers).
- `we:src/assets/icons/webrouting.svg` — route-tree icon, mirrors the webgraph palette.
- `we:src/_data/blocks/router.json` — gains `relatedProject: webrouting` (was floating in the generic webblocks catalog).

Mirrors webgraph slice #1372. Root slice — B (#1721 route-map schema) and the URL-as-state / sitemap slices build on it.
