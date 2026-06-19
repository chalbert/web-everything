---
type: idea
workItem: story
size: 3
parent: "1096"
status: open
dateOpened: "2026-06-19"
tags: []
---

# webexpressions: observer upgrades addedNodes (dynamic insertion)

Extend the MutationObserver in we:plugs/webexpressions/CustomTextNodeRegistry.ts:282-298 to process addedNodes (currently removedNodes only), calling the add path (:156-241) on each added subtree — covers innerHTML/insertAdjacentHTML/append-into-connected. Demo: e2e, el.innerHTML='<span>{{name}}</span>' interpolates.
