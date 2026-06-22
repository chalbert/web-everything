---
kind: story
size: 3
parent: "1522"
locus: frontierui
status: resolved
dateOpened: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: "fui:tools/explorer/cli.ts — per-viewport audit loop (recipe viewports, viewport-tagged findings/screenshots)"
tags: []
---

# Explorer CLI: multi-viewport / responsive sweep

Run the sweep across a set of viewports (mobile/tablet/desktop) so viewport-dependent issues (layout overflow, contrast over responsive backgrounds) are caught — the single default viewport misses a whole class.

## Resolved (2026-06-22) — `viewports` in the recipe; the whole audit runs once per viewport

`fui:tools/explorer/authRecipe.ts` gained a `viewports` field (`{ width, height, label? }[]`). `fui:tools/explorer/cli.ts` runs the audit once per viewport — a fresh context sized to each — and tags every finding + screenshot with the viewport label (`route:/home@mobile`), so a responsive sweep distinguishes them in one bundle. Omitted → a single run at the default viewport (unchanged behaviour).

**Validated:** plateau `/home /pricing` at `mobile` (375×812) + `desktop` (1440×900) → `/home@mobile` 2 contrast nodes vs `/home@desktop` 5 — viewport-dependent differences the single-viewport run missed — with per-viewport screenshots (`route-home-mobile.png`, `route-home-desktop.png`). Suite green (88).
