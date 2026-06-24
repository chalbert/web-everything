---
kind: story
size: 3
status: open
blockedBy: []
relatedDecision: 1748
dateOpened: "2026-06-24"
tags: []
---

# Stand up the WE-docs FUI badge/filter-chip loader (cross-origin, rule-7)

Build the #1748-ratified loader: FUI serves a small `fui:embed/badges-in-document.ts` entry that calls registerBadge()+registerFilterChip() and injects the exported CSS once; WE adds a second guarded cross-origin import(...) of that served entry in `we:src/_layouts/base.njk` (mirroring the #865 chrome shell at :418) plus a `we-badge{}`/`we-filter-chip{}` SSR baseline to kill the upgrade flash. Boundary-legal runtime URL bundle (rule 6), zero new infra (reuses the live frontierUrl origin). Unblocks #1598's docs-pill migration.
