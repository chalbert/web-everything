---
kind: story
size: 5
status: open
blockedBy: ["1987"]
dateOpened: "2026-06-30"
dateStarted: "2026-07-01"
tags: []
---

# Conformance cleanup: migrate bare-hyphen behavior attrs to colon namespace + normalize route:guard:leave

Triggered by #1987's Fork 1 ruling (colon is the collision-safe namespace; bare-hyphen behavior attrs are the actually-unsafe names). In Frontier UI, migrate the ~8 bare-hyphen behavior attribute names (type-ahead, droplist-anchor/anchored/selection, focus-delegation, navigation-guard) into the colon namespace (e.g. droplist:anchor), and normalize the double-colon outlier route:guard:leave (no precedent on any convention) to single-colon route:guard-leave. Mechanical rename + registration update; keep back-compat aliases if any author surface depends on the old names.

## Grounding — resized to story·5 + naming sub-fork (batch-2026-06-30, released not resolved)

Two findings on grounding, both blocking a clean batch:

- **Not a mechanical `task` — it's a cross-repo story·5.** The touch-set is ~30 FUI code sites (`fui:blocks/type-ahead/registerTypeAhead.ts`, `fui:blocks/droplist/registerDroplistMenu.ts:52-55`, `getAttribute`/`matches` reads incl. `fui:blocks/router/types.ts:319` for `route:guard:leave`) **plus** 3 FUI demos under `fui:demos/` (data-grid, droplist-selection, autocomplete-unplugged) **plus** ~10 WE block-description docs under `we:src/_includes/block-descriptions/` that show these attrs (type-ahead, autocomplete, multi-select-dropdown, data-table, menu, …) **plus** back-compat aliases (author surfaces DO depend on the old names — the demos/docs above) **plus** all-engine tests. Retyped `task → story·5`.
- **`type-ahead`'s colon target is an unpinned naming fork.** #1987 Fork 1 ratified the DIRECTION (bare-hyphen → colon) and the `namespace:member` pattern, but only `droplist:anchor` is a clean family. `droplist:anchored/selection`, `focus:delegation`, `navigation:guard` follow first-hyphen→colon sensibly; **`type-ahead` does not** — there is no `type:` behavior family, and `type:ahead` both reads wrong and visually rhymes with the `type=` attribute. Candidate targets: `type:ahead` (literal), `list:type-ahead` / `nav:type-ahead` (member keeps its internal hyphen like `grid:cell-edit`), or leave `type-ahead` as an accepted compound. **Pick this before the rename** — an agent must not choose the spelling unilaterally (naming-fork precedent discipline). Likely a one-line addendum to #1987's codified anchor rather than a new decision item.
