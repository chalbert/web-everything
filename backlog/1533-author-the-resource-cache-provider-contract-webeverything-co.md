---
kind: story
size: 3
parent: "1460"
status: resolved
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: "we:blocks/resource-cache/contract.ts"
tags: []
---

# Author the resource-cache provider contract + @webeverything/contracts re-export

Author we:blocks/resource-cache/contract.ts: the key->{data,staleness,revalidate} swappable runtime-DI cache provider contract plus the technical knobs (dedupe, freshWindow/evictAfter ms, revalidateOn, dependsOn) that the UX-only query intent keeps off its surface (#1419 amendment). Add the type-only re-export we:contracts/resource-cache.ts (export type * from ../blocks/resource-cache/contract) and the exports entry in we:contracts/package.json. Net-new — #1395 shipped no provider contract. Foundational slice B of #1460; independent of the intent (A); blocks the FUI impl (C).
