---
kind: story
size: 5
status: resolved
dateOpened: "2026-07-01"
dateStarted: "2026-07-01"
dateResolved: "2026-07-01"
tags: []
---

# Execute behaviour-attr colon migration (family-only per #1991)

Mechanical cross-repo rename ratified by #1991: colon-ify only genuine families — droplist-anchor/anchored/selection → droplist:*, and route:guard:leave → route:guard-leave. Leave family-less attrs (type-ahead, focus-delegation, navigation-guard) bare. Covers ~30 FUI code sites (getAttribute/matches reads), FUI demos (data-grid, droplist-selection, autocomplete-unplugged), ~10 WE block-description docs, back-compat aliases for changed names (author surfaces depend on old names), and all-engine tests. Family-less attrs unchanged.

## Outcome (#2048)

Executed per #1991's family-only ruling. Only the two genuine families renamed; back-compat aliases keep every old author surface working.

**FUI (frontierui):**
- `frontierui:blocks/droplist/registerDroplistMenu.ts` — registers `droplist:anchor` / `droplist:anchored` / `droplist:selection` (canonical), plus the three pre-#1991 bare `droplist-*` names as back-compat aliases pointing at the same behaviour classes. `focus-delegation` stays bare (family-less).
- `frontierui:blocks/router/types.ts` — `parseRouteDefinitions` reads `route:guard-leave` (canonical) with a fallback to the old `route:guard:leave` (back-compat); doc comments updated.
- `frontierui:src/_data/blocks.json` — droplist entry's `registeredNames` gains the three `droplist:*` names (keeps the bare aliases) so the #783 sibling-drift gate stays green.
- Tests: droplist + router unit/integration suites migrated to the new names, with dedicated tests exercising each back-compat alias (83 tests green).

**WE (webeverything) — docs/spec surfaces only (WE holds zero impl, #6):**
- `we:src/_data/blocks/router.json` — attr `name` → `route:guard-leave` (+ back-compat note in its description); reference mentions updated. This is the CEM source; `we:custom-elements.json` regenerates from it.
- `we:src/_data/semantics/guard.json` / `we:src/_data/semantics/leave-guard.json` / `we:src/_data/semantics/route-guard.json` — surface vocabulary updated to `route:guard-leave`.
- `we:src/_includes/block-descriptions/router.njk` — all `route:guard:leave` prose/code/table occurrences → `route:guard-leave`, with a back-compat-alias note on the authoring-surface table row.

Family-less attrs (`type-ahead`, `focus-delegation`, `navigation-guard`) left bare, unchanged. Derived `we:custom-elements.json` deferred to the integrator's regen.
