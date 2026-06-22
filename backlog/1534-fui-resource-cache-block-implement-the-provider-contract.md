---
kind: story
size: 5
parent: "1460"
status: resolved
blockedBy: ["1533"]
dateOpened: "2026-06-22"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
locus: frontierui
tags: []
---

# FUI resource-cache block — implement the provider contract

Implement the resource-cache provider as a FUI block (or a resource-loader extension): keyed cache, staleness tracking, revalidate, and invalidate-on-mutation, conforming to the key->{data,staleness,revalidate} contract. Imports @webeverything/contracts/resource-cache. Cross-repo (locus: frontierui), extends the existing fui resource-loader surface. Slice C of #1460; blockedBy the WE contract slice B (#1533); unblocks the demo (D).

## Progress

- `fui:blocks/resource-cache/InMemoryResourceCache.ts` — the default runtime impl of the #1533 `ResourceCacheProvider` contract: keyed cache (stable structured-key serialization), `read → {data, staleness, revalidate}` surface, stale-while-revalidate (a `stale` read still serves the last value), request `dedupe` (coalesces concurrent fetches), `freshWindow` (fresh→stale), `evictAfter` (GCs idle unsubscribed entries), `dependsOn` cascade on `invalidate`, `write` (seed fresh), `subscribe` (fires on change), and `revalidateOn` triggers (`focus`/`reconnect`/`mount`/`interval`). The fetcher is a construction option (the contract read surface deliberately omits it). Barrel `fui:index.ts`.
- Staleness ordering pin: `missing` (never loaded — no value yet) takes precedence over `revalidating` (refreshing an EXISTING value), so a first fetch reads `missing` while in flight.
- Wired `@webeverything/contracts/resource-cache` into FUI `fui:tsconfig.json` paths + `fui:vitest.config.ts` alias (the #1533 type-only contract, sibling-resolved).
- Registered the `resource-cache` block in `fui:src/_data/blocks.json` (catalog-completeness rule) → added to `DEMO_PENDING` (its live demo is the explicitly-separate **slice D**, which this slice unblocks). **Bonus registry hygiene this batch enabled:** wired the `dockable` block's `demoFile` to the `fui:dockable-dock-demo.html` I built in #1512 and removed `dockable` from `DEMO_PENDING` (its anticipated demo has now landed).
- Unit tests `fui:InMemoryResourceCache.test.ts` (9): missing→fresh fetch, stable structured keys, freshWindow→stale + revalidate, dedupe, invalidate + dependsOn cascade (SWR), invalidate-all, write-seeds-fresh, subscribe/unsubscribe, evictAfter. All green; FUI `check:standards` 0 errors.
