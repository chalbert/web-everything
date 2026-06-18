---
type: idea
workItem: story
size: 8
status: resolved
blockedBy: []
dateOpened: "2026-06-11"
dateStarted: "2026-06-11"
dateResolved: "2026-06-11"
graduatedTo: "intent:hierarchy"
tags: []
---

# Author the hierarchy intent standard

Author a first-class hierarchy intent — the nesting paradigm (role=tree › treeitem › role=group) that tree-select and future treegrid/nested-menus compose. Owns: the flatten-to-visible-rows projection (so Windowed Collection needs no tree-specific changes), Right/Left expand-then-descend / collapse-then-ascend traversal, aria-level/setsize/posinset, and the dimensions selectableNodes (any|leaf, default any), cascade (off|descendants|ancestors|both, default off) + valueReporting (all|leaves|parents, default all) gated to selection.model=multiple. Composes the **existing** disclosure intent (we:intents.json `id: disclosure`, graduated from #008) for per-node expand state — no new disclosure work needed; delegates selection→Selection, focus→Focus-Delegation (DI-injectable strategy), type-ahead→Type-Ahead. Ruled in #064; grounded in we:reports/2026-06-11-tree-select-hierarchical-selection.md.

## Delivery (2026-06-11)
Authored the **`hierarchy`** intent (`status: draft`) in `we:src/_data/intents.json` —
spliced as a single entry (no whole-file roundtrip, per the mixed-escaping footgun).
Renders at `/intents/hierarchy/` (verified via `build:check`).

- **Dimensions** (defaults stated in the description prose, matching the disclosure
  convention): `selectableNodes` (`any` default · `leaf` opt-in), `cascade`
  (`off` default · `descendants`/`ancestors`/`both`, **gated to
  `selection.model = multiple`**), `valueReporting` (`all` default ·
  `leaves`/`parents`, also multi-select-gated → Ant `showCheckedStrategy`).
- **Owns**: the flatten-to-visible-rows projection (so Windowed Collection needs
  zero tree-specific changes — tree-ness is per-row metadata), Right/Left
  expand-then-descend / collapse-then-ascend traversal, `aria-level/setsize/posinset`,
  and the collapse-focuses-ancestor invariant.
- **Composes / delegates**: composes the existing `disclosure` intent for per-node
  expand state (no new disclosure work); delegates selection→Selection,
  focus→Focus-Delegation (DI-injectable `virtual`|`roving`), type-ahead→Type-Ahead.
- **Native baseline**: there is no native tree (`<optgroup>` can't nest, `<details>`
  has no selection) → ARIA-composed; degrades to single-level grouped `<select>`.
- `we:AGENTS.md` inventory regenerated (+1 intent). All grounded in the #064 ruling +
  the cited prior-art report. No `requiresCapabilities` (no native tree capability).
