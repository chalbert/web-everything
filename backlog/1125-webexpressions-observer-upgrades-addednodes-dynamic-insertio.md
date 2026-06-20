---
kind: story
size: 3
parent: "1096"
status: resolved
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "we:plugs/webexpressions/CustomTextNodeRegistry.ts"
tags: []
---

# webexpressions: observer upgrades addedNodes (dynamic insertion)

Extend the MutationObserver in we:plugs/webexpressions/CustomTextNodeRegistry.ts:282-298 to process addedNodes (currently removedNodes only), calling the add path (:156-241) on each added subtree — covers innerHTML/insertAdjacentHTML/append-into-connected. Demo: e2e, el.innerHTML='<span>{{name}}</span>' interpolates.

## Progress

Extended the `MutationObserver` in `we:plugs/webexpressions/CustomTextNodeRegistry.ts` (`#createObserver`)
to process `addedNodes` (was `removedNodes`-only): each added subtree runs through the existing add path
`#addTextNodesOnTree` → `#applyOnTree(tree, 'add')`, which walks `SHOW_TEXT` and upgrades/`connectedCallback`s
its custom text nodes — so a subtree inserted **after** `upgrade()` (innerHTML / insertAdjacentHTML / append
into a connected tree) interpolates its `{{ }}`/`[[ ]]` bindings, mirroring the removed-node teardown.

Test `we:plugs/webexpressions/__tests__/unit/CustomTextNodeRegistry.addedNodes.test.ts` — 3 green:
a custom text node appended after upgrade is connected; an inserted element subtree has its custom text
descendants upgraded (the innerHTML case); the removedNodes teardown still fires (no regression). WE
`check:standards` 0 errors. (Unit-tested in happy-dom — detached container to avoid a happy-dom focus-track
crash on `new`-constructed text-node disconnect; the assertion is the observer add-path, not document focus.)
