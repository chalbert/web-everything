# Tree-select & hierarchical selection — prior-art survey

**Date**: 2026-06-11
**Point**: Web-platform and library prior art for a hierarchical member of the droplist family, grounding backlog #064's three open forks (where hierarchy lives, windowing interaction, leaf-vs-any commit) and surfacing a fourth the item omitted (multi-select parent/child cascade).
**Backlog item**: `/backlog/064-tree-select-block/`
---

## Question

Tree-select is named as a concrete droplist member ([fui:blocks.json:21](../src/_data/blocks.json#L21)) but no design exists. Before authoring an intent/block standard, survey prior art per [we:design-first.md](../docs/agent/design-first.md) step 1, so the trait selections for hierarchy, expand/collapse, focus, and commit-depth reuse platform vocabulary instead of coining terms.

## Key findings

### 1. The platform separates THREE axes — disclosure, hierarchy, selection — and treats them independently

WAI-ARIA APG **Tree View pattern** ([w3.org APG](https://www.w3.org/WAI/ARIA/apg/patterns/treeview/)) and every surveyed library model expand/collapse **separately from** selection. This is unanimous (Ant, MUI, Fluent, Carbon, PrimeReact, Shoelace all use distinct controlled/uncontrolled prop pairs for `expanded` vs `selected`).

- **Disclosure** (open/closed, `aria-expanded`): the pure expand/collapse paradigm. Shared with native `<details>`/`<summary>` (which nests arbitrarily but has *no* selection model), accordions, disclosure widgets. APG names this pattern "disclosure".
- **Hierarchy** (the nesting structure): `role=tree` › `treeitem` › `role=group` › child `treeitem`s. A parent's children are wrapped in a `group`, not direct descendants. Carries `aria-level`, `aria-setsize`, `aria-posinset`.
- **Selection** (`aria-selected` / `aria-multiselectable`): already owned by WE's Selection Intent ([we:intents.json:1059](../src/_data/intents.json#L1059)).

**Implication for fork #1:** the hierarchy concept is real and distinct, but it decomposes — disclosure is a reusable paradigm in its own right (details, accordion, tree all compose it), and selection already has a home. A `hierarchy` intent should own the *nesting structure + traversal*, delegate selection to Selection, and either fold in or compose a separate `disclosure` axis.

### 2. Keyboard model is fully specified by APG (reuse verbatim)

From the APG keyboard table:
- **Right Arrow**: closed node → opens it (focus stays); open node → moves to first child; end node → nothing.
- **Left Arrow**: open node → closes it; child that is an end/closed node → moves to parent; root end/closed node → nothing.
- **Up/Down**: move through the *focusable (visible)* set without opening/closing.
- **Home/End, type-ahead, `*` (expand siblings)**: standard.

So Right/Left carry BOTH expand/collapse and horizontal traversal; Up/Down never change disclosure. Type-ahead is the existing Type-Ahead intent, already noted as reused by trees ([fui:blocks.json:125](../src/_data/blocks.json#L125)).

### 3. Selection allows ANY node, not just leaves — leaf-only is opt-in (grounds fork #3)

- **APG**: any `treeitem` may carry `aria-selected`; only `aria-expanded` is reserved to parents. Selection is independent of disclosure — a collapsed folder can be selected.
- **Cross-library consensus**: every surveyed library makes **any node selectable by default**. None defaults to leaf-only. Only **Shoelace** offers an explicit opt-in `leaf` mode (`<sl-tree selection="single|multiple|leaf">`), and even there it is not the default.
- **MUI** restricts per-item via `isItemSelectionDisabled`; the rest via mode flags.

**Verdict for fork #3:** any-depth commit is the grounded default; leaf-only is an author opt-in constraint — matching Shoelace's enum and Selection Intent's existing `constraints` pattern.

### 4. Windowing = flatten-to-visible-rows; the real coupling is FOCUS, not offset math (grounds fork #2)

The universal virtualization technique (react-arborist, TanStack Table+Virtual, ag-Grid tree data) is to **flatten the tree to a linear array of currently-visible rows** (nodes whose ancestors are all expanded) and virtualize that flat list like any list. Hierarchy survives only as per-row metadata (level, posinset, setsize, expanded). Expand/collapse just changes the flat array's length → the list virtualizer recomputes cumulative offsets from its measurement cache. **No tree-specific offset math exists.**

So Windowed Collection needs **zero tree-specific changes** — tree-ness is a projection step the hierarchy intent owns.

**But research relocated the hard part.** The load-bearing question is the **focus model under virtualization**:
- The droplist family uses **`virtual` focus** (`aria-activedescendant`) ([we:intents.json:62-85](../src/_data/intents.json#L62-L85)). Under windowing, `aria-activedescendant` must reference a **real, owned, mounted** DOM element, and the browser does **not** auto-scroll to it — JS must keep it mounted and scroll it into view ([MDN](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-activedescendant), [w3c/aria-practices#2052](https://github.com/w3c/aria-practices/issues/2052)).
- This is **exactly** the active-always-mounted invariant Windowed Collection already mandates ([we:intents.json:358](../src/_data/intents.json#L358); proven in [#163](../backlog/163-windowed-variable-row-heights.md)/[#145](../backlog/145-windowed-scroll-height-driven-path.md)). So virtual focus *is* viable under windowing — the invariant the item worried about is the very thing that makes it work.
- Counterpoint ([Sarah Higley](https://sarahmhigley.com/writing/activedescendant/)): for giant virtualized trees, **roving tabindex** is more robust (browser handles scroll-into-view; focus dies only if the row unmounts). Trade is family-inconsistency.
- **Collapse-with-focused-descendant**: APG specs Left-Arrow → focus to *parent*, but does **not** cover collapsing a node while a *deep* descendant holds focus. Library convention (react-arborist) moves focus up to the collapsing ancestor. This guarantees the focused node is always in the visible projection, so "deep leaf in a collapsed branch" cannot arise — answering the item's worry.

### 5. Native baseline: there is NO native tree-select

`<select><optgroup>` is **flat — optgroup cannot nest** ([MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/optgroup); proposal [whatwg/html#5789](https://github.com/whatwg/html/issues/5789) is not standardized). `<details>` gives recursive disclosure but no selection. So tree-select is necessarily an ARIA-composed custom widget; the native-first baseline degrades to single-level grouped `<select>`.

### 6. Data shape: nested children dominant; flat+parentId is the large-tree variant

Two camps — nested `children` (Ant `treeData`, PrimeReact, MUI RichTreeView) or declarative child elements (MUI SimpleTreeView `<TreeItem>`, Carbon `<TreeNode>`, Shoelace `<sl-tree-item>`) — plus a deliberate **flat-list+parentId** variant for large/virtualized trees (Fluent `FlatTree`, Ant `treeDataSimpleMode`). WE's HTML-first / Compound-Child paradigm aligns with declarative nested elements (`<sl-tree-item>`-style), projected to the flat visible-rows model for windowing.

### 7. NEW fork the item omitted — multi-select parent/child cascade

For **multi-select** trees, checking a parent can cascade to all descendants, with parents showing an **indeterminate/mixed** state on partial selection. This is a real, divergent axis:
- **Cascade ON by default** (checkbox mode): Ant (`treeCheckable`), Fluent, Shoelace (`multiple`), PrimeReact (`checkbox`) — with indeterminate ancestors.
- **Cascade OFF by default**: MUI (`selectionPropagation` both false).
- **No cascade**: Carbon.
- Ant also exposes `treeCheckStrictly` (decouple) and `showCheckedStrategy` (which nodes the value reports: `SHOW_CHILD`/`SHOW_PARENT`/`SHOW_ALL`).

This belongs in #064's scope as a fourth decision (a dimension on the multi-select-tree member), not a silent omission.

## Recommendation (to ratify in #064)

1. **New `hierarchy` intent** (APG term, not the item's `tree-collection`) owning nesting structure + flatten-to-visible-rows projection + Right/Left traversal + `aria-level/setsize/posinset`. Delegates selection to Selection, focus to Focus-Delegation, type-ahead to Type-Ahead. **Sub-decision:** factor a separate `disclosure` intent (reused by details/accordion) vs. fold open/closed state into `hierarchy`.
2. **Windowing unchanged** — flat visible-rows projection. Keep the family's **`virtual` focus**; active-always-mounted (already mandated) satisfies the `aria-activedescendant` keep-mounted+scroll requirement. Adopt collapse-focuses-ancestor so the focused node is always in the projection.
3. **`selectableNodes: any | leaf` dimension**, default **`any`** (APG + library consensus), `leaf` the opt-in constraint.
4. **(new) Multi-select cascade dimension** — capture parent/child cascade + indeterminate + value-reporting strategy as part of the multi-select-tree member.

## Files Created/Modified

| File | Action |
| --- | --- |
| `we:reports/2026-06-11-tree-select-hierarchical-selection.md` | Created (this report) |
