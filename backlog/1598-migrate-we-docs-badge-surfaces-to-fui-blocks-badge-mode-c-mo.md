---
kind: story
size: 3
parent: "866"
status: open
blockedBy: ["1603"]
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
tags: []
---

# Migrate WE-docs badge surfaces to FUI blocks/badge (mode-C mount)

Migrate the ~25 badge surfaces across src/*.njk + _includes to FUI blocks/badge mounted via the mode-C inline SDK (docs analogue of #865's chrome mount). The smallest surface — proves the inline <surface>→FUI mount transform that #867/#868/#869 replay. Gate npm run verify + a :8080 render check.

## Pre-flight (batch-2026-06-22-1596-1593) — buried dependency on #1603; not a ready 3

The ~25 surfaces are `badge` **and** `filter-chip` (the `we:src/_includes/backlog-badges.njk` macros + the
Prioritisation chips). FUI ships `fui:blocks/badge/` but **not** `fui:blocks/filter-chip` — and the central
`we:src/_includes/backlog-badges.njk` dogfood-seam note states the macro swap waits on "FUI shipping
`badge`/**`filter-chip`**". That component is exactly what **#1603** builds. So this migration is
**blocked-in-fact** until #1603 ships both components — encoded as `blockedBy: ["1603"]` (was a missing
edge). Released from batch-2026-06-22-1596-1593 unbuilt. Un-blocks the moment #1603 resolves; then verify
the inline mode-C render path also covers many-small-component mounts (the `#765/#728` half of the seam note).
