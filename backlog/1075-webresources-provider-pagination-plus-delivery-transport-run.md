---
type: idea
workItem: story
size: 5
parent: "1027"
status: resolved
blockedBy: ["1074"]
dateOpened: "2026-06-19"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "fui:plugs/webresources/index.ts"
tags: []
---

# webresources provider — pagination plus delivery-transport runtime in FUI

Slice B of webresources impl epic #1027 (blockedBy slice A contract). Implement the pagination + delivery-transport runtime in FUI, conforming to the WE contract; swappable provider.

## Resolution (batch-2026-06-19)

Built in `fui:plugs/webresources/` (headless runtime → plug):

- `fui:plugs/webresources/provider.ts` — `coldConsumable` (Apollo-Link cold observable, independent per-subscribe execution) + `NativeResourceClient`, the native REST transport over an injected `fetch` returning a cold `Consumable<ResourceResult>` with abort-on-unsubscribe (transport decoupled from policy, #1027 ruling 2).
- `fui:plugs/webresources/pagination.ts` — `offsetPagination` (exposes `total` → jump/rangeLabel) and `cursorPagination` (no `total`, next/prev via cursor stack), the two families the #061 discriminated union fixes apart.
- `fui:plugs/webresources/registry.ts` — `CustomResourceRegistry`, entity→`ResourceDefinition` map + the swappable resolved client (REST→GraphQL→WS via `setClient`).
- `fui:plugs/webresources/index.ts` — `createDefaultResourceRegistry()` over the native client.

Conforms to `@webeverything/contracts/resources` (FUI→WE arrow). Added the WE distribution seam (`we:contracts/resources.ts` re-export of `we:resources/contract.ts` + `./resources` subpath) + FUI path-maps + the `webresources` `fui:src/_data/plugs.json` entry. Covered by `fui:plugs/webresources/__tests__/webresources.test.ts` (6 tests incl. the offset-has-total / cursor-no-total constraint). FUI `check:standards` green.
