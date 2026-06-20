---
kind: story
size: 2
parent: "1096"
status: resolved
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "we:plugs/webexpressions/CustomTextNodeRegistry.ts"
tags: []
---

# webexpressions: cloak removal after upgrade

After a node upgrades, remove the nearest ancestor [cloak] attribute once its subtree expressions are upgraded — hook we:plugs/webexpressions/CustomTextNodeRegistry.ts:80-136 (spec we:src/_includes/project-webexpressions.njk:247-268,841). Demo: unit, <div cloak>{{x}}</div> loses cloak after upgrade.

## Progress

Added CSS-cloak removal to `we:plugs/webexpressions/CustomTextNodeRegistry.ts`: a `#removeCloak(tree)` hook
called at the end of `#addTextNodesOnTree` (the shared add path — so it fires on both `upgrade()` and the
#1125 dynamic-insertion observer). Once a subtree's expressions are upgraded it reveals the subtree by
dropping `[cloak]` from any cloaked element within `tree` (and `tree` itself), plus the nearest cloaked
ancestor that hid it — the v-cloak/x-cloak pattern (spec njk:247-268).

Unit test `we:plugs/webexpressions/__tests__/unit/cloakRemoval.test.ts` — 4 green (`<div cloak>{{x}}</div>`
loses cloak after upgrade, root-element cloak removed, nearest-ancestor cloak removed when a nested subtree
upgrades, uncloaked elements untouched). Full webexpressions suite 95 green; WE `check:standards` 0 errors.
