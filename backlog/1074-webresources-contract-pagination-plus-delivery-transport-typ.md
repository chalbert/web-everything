---
type: idea
workItem: story
size: 3
parent: "1027"
status: resolved
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "we:resources/contract.ts"
tags: []
---

# webresources contract — pagination plus delivery-transport types in @webeverything

Slice A of webresources impl epic #1027. Define the webresources contract (pagination + delivery-transport types) in @webeverything per the resolved #061/#455 design. Type-only crosses the seam (npm scope mirrors layer). Foundation slice — B and C build on it.

## Progress

Shipped `we:resources/contract.ts` — the pure-contract half (compile-erased, future
`@webeverything/contracts/resources`): the pagination types (`CustomPagination<T>`,
`CustomPaginationDefinition` — a discriminated union encoding the #061 cursor-vs-offset/page `total`
pairing constraint in the type) + the client-initiated request/response delivery-transport types
(`CustomResourceClient` execute → cold `Consumable`, `ResourceOperation`, `ResourceResult`,
`ResourceDefinition`). Mirrors the shapes in `we:src/_data/resources.json` (#061 pagination, #455
pull-transport home). Server→client transports homed elsewhere by purpose (push→webnotifications,
realtime→webrealtime). Runtime clients + pagination iterators + `customResources` registry stay impl
(→ FUI).
