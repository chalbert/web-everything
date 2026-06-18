---
type: decision
workItem: story
size: 5
status: resolved
dateOpened: "2026-06-03"
dateStarted: "2026-06-11"
dateResolved: "2026-06-11"
graduatedTo: none
tags: [droplist, tree-select, hierarchical, block, traits]
relatedProject: webblocks
relatedReport: reports/2026-06-11-tree-select-hierarchical-selection.md
preparedDate: "2026-06-11"
crossRef:
  url: /blocks/droplist/
  label: droplist family page
---

# Design and author the tree-select block standard

A hierarchical concrete member of the droplist family: an anchored surface whose collection is a `role=tree` rather than a `role=listbox` ([fui:blocks.json:21](../src/_data/blocks.json#L21)), with expandable group nodes and selection commit at leaf or any-node depths. No design exists yet — the trait selections for hierarchy, expand/collapse, focus, and commit-depth must be ruled on before a block standard can be written. The four forks below are grounded in a prior-art survey (WAI-ARIA APG, Ant/MUI/Fluent/Carbon/PrimeReact/Shoelace, tree-virtualization libs), published as the [Tree-select & Hierarchical Selection](/research/tree-select-hierarchical-selection/) research topic. Each names a recommended default in **bold**.

The platform separates three axes that every surveyed library and the APG keep independent: **disclosure** (open/closed, `aria-expanded`, shared with `<details>`/accordion), **hierarchy** (the `role=tree`›`treeitem`›`group` nesting), and **selection** (`aria-selected`, already owned by Selection Intent — [we:intents.json:1059](../src/_data/intents.json#L1059)). The droplist composes nine intents today but none owns hierarchy ([fui:blocks.json:22-32](../src/_data/blocks.json#L22-L32)).

### Recommended path at a glance

Ratify all four rows, or override just the one you'd change. The **confidence** column says where judgment is actually needed vs. where to nod.

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **1 · hierarchy home** | new first-class `hierarchy` intent the droplist composes | stretch Selection + Focus-Delegation *(rejected)* | **High** — APG + composition-over-monolith |
| **2 · windowed / focus** | flat visible-rows projection + DI-resolvable `virtual` focus | roving tabindex (giant trees) | **Med-high** — alt legit only at extreme scale |
| **3 · commit depth** | `selectableNodes: any` (`leaf` = opt-in) | `leaf`-only | **High** — APG + 6-library consensus |
| **4 · multi-select cascade** | `cascade: off` + `valueReporting` dimensions | cascade-on-by-default | **Low** — divergent across libraries; your call |

## Fork 1 — where does hierarchy live?

Selection's `grouping` dimension can't stretch: it explicitly *arranges* flat labeled sets and **groups do not nest** ([we:intents.json:1098](../src/_data/intents.json#L1098); native `<optgroup>` can't nest — [whatwg/html#5789](https://github.com/whatwg/html/issues/5789)). Options:

- **(A — recommended) New first-class `hierarchy` intent** the droplist composes only for tree-select. Owns nesting structure + flatten-to-visible-rows projection + Right/Left traversal + `aria-level/setsize/posinset`; delegates selection→Selection, focus→Focus-Delegation, type-ahead→Type-Ahead. Matches "composition over monolith" ([fui:blocks.json:35](../src/_data/blocks.json#L35)); name follows the APG term `tree`/`hierarchy`, not the item's original `tree-collection` (intents name paradigms, not widgets — cf. `focus-delegation`). Cost: a new intent to author.
- **(B) Stretch Selection + Focus-Delegation.** Cheaper now; overloads two intents with a structural concept one disclaims, splits tree behavior across two homes. Rejected.
- **Sub-decision:** factor a separate **`disclosure` intent** (reused by `<details>`/accordion) vs. fold open/closed state into `hierarchy`.

## Fork 2 — Windowed Collection interaction (and the real coupling: focus)

The universal virtualization technique flattens the tree to a flat array of currently-visible rows and windows that like any list — **so Windowed Collection needs zero tree-specific changes**; the projection is `hierarchy`'s job. The hard part research relocated is **focus**: the family uses `virtual` focus (`aria-activedescendant` — [we:intents.json:62-85](../src/_data/intents.json#L62-L85)), which under windowing requires the active node to stay a mounted, owned, scrolled-into-view element. That is *exactly* the active-always-mounted invariant Windowed Collection already mandates ([we:intents.json:358](../src/_data/intents.json#L358)) — so virtual focus is viable and the item's "deep leaf in a collapsed branch" worry dissolves: collapsing a branch moves focus up to the collapsing ancestor (APG Left-Arrow + library convention), so the focused node is always in the projection.

- **(recommended)** Flat visible-rows projection + keep `virtual` focus + collapse-focuses-ancestor. Windowing untouched.
- **(alt)** Switch tree-select to **roving tabindex** (more robust for giant trees per [Higley](https://sarahmhigley.com/writing/activedescendant/); browser handles scroll-into-view) at the cost of family inconsistency.

## Fork 3 — single-select commit depth

APG allows `aria-selected` on **any** `treeitem` (only `aria-expanded` is parent-only), and **every** surveyed library makes any node selectable by default; only Shoelace offers an opt-in `leaf` mode, still not the default. Both end-states are legitimate (file-picker = leaf; category/org-unit picker = folder-as-value), so this is a configurable dimension, not a baked mechanic.

- **(recommended) `selectableNodes: any | leaf` dimension, default `any`**; `leaf` the opt-in constraint, mirroring Selection's existing `constraints` pattern.

## Fork 4 — multi-select parent/child cascade (surfaced by research; the item omitted it)

For multi-select trees, checking a parent can cascade to all descendants with an indeterminate/mixed state on partial selection. Divergent across libraries: cascade ON by default in Ant/Fluent/Shoelace/PrimeReact (checkbox mode), OFF in MUI, absent in Carbon; Ant also exposes which nodes the value reports (`SHOW_CHILD`/`SHOW_PARENT`/`SHOW_ALL`).

- **(recommended)** Capture as a **cascade dimension** (+ indeterminate + value-reporting strategy) on the multi-select-tree member, not the base. Ratify default and whether it lives on `hierarchy` or `selection`.

## Progress

**Status:** resolved 2026-06-11 — all four forks ruled; spun off #295/#296 (disclosure intent already exists, graduated from #008) (research captured in `relatedReport`).

**Decisions made:**
- **Fork 1 → A (2026-06-11):** new first-class `hierarchy` intent the droplist composes for tree-select; owns nesting + flatten-to-visible-rows projection + Right/Left traversal + `aria-level/setsize/posinset`; delegates selection→Selection, focus→Focus-Delegation, type-ahead→Type-Ahead. Name = `hierarchy` (APG term), not `tree-collection`. **Sub-decision → separate `disclosure` intent (2026-06-11):** open/closed is its own reusable axis (`<details>`/accordion compose it with no tree); `hierarchy` *composes* `disclosure` for per-node expand state rather than absorbing it. Bias toward separation/decoupling.
- **Fork 2 → DI-injectable focus (2026-06-11):** the flat-visible-rows projection, windowing-untouched, collapse-focuses-ancestor, and active-always-mounted are **fixed mechanics** (hold under any strategy). The focus strategy itself is **not** hardcoded for tree-select — it stays the existing behavioral, DI-resolvable Focus-Delegation dimension (`virtual | roving | native`, default `virtual`, `roving` available for giant trees), per the two-channel rule ([fui:blocks.json:37](../src/_data/blocks.json#L37)).
- **Fork 3 → `any` default (2026-06-11):** `selectableNodes: any | leaf` dimension on `hierarchy`, default **`any`** (most-flexible default; `leaf` is the opt-in constraint), mirroring Selection's `constraints` pattern. Grounded in APG + 6-library consensus.

- **Fork 4 → fully-configurable intent dimensions (2026-06-11):** cascade is **not a protocol** (deterministic transform, no swappable-vendor interop story; a protocol would be lock-in for no gain) — it's an **intent-composition seam** between `selection` (model=multiple + value model) and `hierarchy` (the parent/child edges). Because it affects intents, expose the **whole axis as configurable** (not one baked behavior), on `hierarchy`, gated to `selection.model=multiple`: `cascade: off | descendants | ancestors | both` (default `off`); `valueReporting: all | leaves | parents` (= SHOW_ALL/SHOW_CHILD/SHOW_PARENT, default `all`); indeterminate ancestor state automatic when cascade rolls up. Most-flexible defaults throughout.

**Outcome (2026-06-11):** all four forks ruled (above). Decision graduates to three now-agent-ready authoring builds with a blockedBy chain reflecting the composition order:
- **#295** — author the `hierarchy` intent (nesting + projection + traversal + selectableNodes/cascade/valueReporting dimensions; composes the **existing** `disclosure` intent, graduated from #008 — no new disclosure work). Now agent-ready.
- **#296** — author the tree-select block (thin trait selection; composesIntents += hierarchy), *blocked by #295*.

No single graduated entity — the ruling is captured here + in the report; the build is the three spin-offs.
