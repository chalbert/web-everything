---
type: idea
workItem: story
size: 5
status: resolved
blockedBy: ["295"]
dateOpened: "2026-06-11"
dateResolved: "2026-06-12"
graduatedTo: "block:tree-select"
tags: []
---

> **Resolved 2026-06-12 — built (driven by auto-insurance S2, [#413]).** The `tree-select` block ships:
> `TreeSelectBehavior` (`blocks/tree-select/TreeSelectBehavior.ts`, active, 6 unit tests) realizes the
> `hierarchy` intent — `role="tree"`/`treeitem`/`group` with `aria-level`/`setsize`/`posinset`,
> Right/Left expand-then-descend / collapse-then-ascend + Up/Down/Home/End keyboard, node selection
> (`aria-checked`, single|multiple) with `cascade` (mixed parents), built from a declarative `TreeNode[]`,
> emitting `tree-change`. Registry entry + `block-descriptions/tree-select.njk` (WAI-ARIA APG Tree View
> alignment) + first consumer = the auto-insurance coverage builder. The deeper cross-field eligibility
> constraints (collision-requires-comp etc.) are the configurator constraint-graph gap ([#096]).

# Author the tree-select block standard

Author the tree-select block — a concrete hierarchical member of the droplist family. Thin trait selection over the substrate: composesIntents += hierarchy (#295), model=single|multiple, optional windowed; role=tree collection instead of role=listbox. No new behavior — every hard part is delegated to a composed intent per #064's ruling. Needs the block registry entry in blocks.json, block-descriptions/tree-select.njk (overview, Web Standards Alignment table citing WAI-ARIA APG, Framework Research table, features, API), and demo. Native-first baseline degrades to single-level grouped `<select>`. Grounded in reports/2026-06-11-tree-select-hierarchical-selection.md.
