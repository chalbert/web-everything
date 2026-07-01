---
kind: decision
status: open
preparedDate: "2026-07-01"
dateOpened: "2026-06-30"
tags: [naming, colon-namespace, attribute-conformance, frontier-ui]
---

# Colon-namespace target for `type-ahead` (the one unpinned name in the bare-hyphen → colon behavior-attr rename)

Forked out of the former migration story (was `story·5`) because the mechanical rename cannot start until one
name is ratified — an agent must not pick an attribute spelling unilaterally (naming-fork precedent
discipline). #1987 Fork 1 already ratified the DIRECTION (colon is the collision-safe namespace; bare-hyphen
behavior attrs are the actually-unsafe names) and the `namespace:member` pattern
(`we:docs/agent/platform-decisions.md#attribute-name-colon-namespacing`). This decision pins the **one member
that pattern doesn't cleanly resolve**, then the rename becomes mechanical.

## The clean renames (no fork — settled by #1987's pattern, execute on ratification)

First-hyphen → colon, member keeps any internal hyphen (like the ratified `grid:cell-edit`):

- `droplist-anchor` → `droplist:anchor`, `droplist-anchored` → `droplist:anchored`,
  `droplist-selection` → `droplist:selection`
- `focus-delegation` → `focus:delegation`
- `navigation-guard` → `navigation:guard`
- the double-colon outlier `route:guard:leave` (no precedent on any convention) → single-colon
  `route:guard-leave`

## The fork — `type-ahead`'s colon target

`type-ahead` does **not** follow the first-hyphen→colon rule: there is no `type:` behavior family, and
`type:ahead` both reads wrong and visually rhymes with the `type=` attribute (the exact collision the colon
namespace exists to avoid). Options:

- **(a) `list:type-ahead` — RECOMMENDED.** Names the host surface (list / combobox) as the namespace and
  keeps the compound member verbatim, exactly the `grid:cell-edit` precedent. Reads as "the type-ahead
  behavior of a list," no collision with `type=`, and the `list:` namespace generalizes to future
  list behaviors.
- (b) `nav:type-ahead` — same member-keeps-hyphen shape, but `nav:` mis-frames it (type-ahead is
  incremental-search selection, not navigation) and overlaps `navigation:guard`'s intent.
- (c) `type:ahead` — literal first-hyphen split; rejected above (reads wrong, rhymes with `type=`).
- (d) leave `type-ahead` an accepted bare compound — but that re-opens the #1987 "bare-hyphen behavior attrs
  are the unsafe names" ruling for this one attr, so it's the least consistent.

Likely a **one-line addendum** to #1987's codified anchor (`we:docs/agent/platform-decisions.md#attribute-name-colon-namespacing`),
not a standalone convention.

## Graduates to (on ratification)

The mechanical cross-repo rename, ~30 FUI code sites (`fui:blocks/type-ahead/registerTypeAhead.ts`,
`fui:blocks/droplist/registerDroplistMenu.ts:52-55`, `getAttribute`/`matches` reads incl.
`fui:blocks/router/types.ts:319` for `route:guard:leave`) **plus** 3 FUI demos under `fui:demos/`
(data-grid, droplist-selection, autocomplete-unplugged) **plus** ~10 WE block-description docs under
`we:src/_includes/block-descriptions/` **plus** back-compat aliases (author surfaces DO depend on the old
names — those demos/docs) **plus** all-engine tests. Re-scaffold as a `story·5` (or execute inline) once the
name is pinned.
