---
kind: story
size: 13
status: open
blockedBy: ["1419"]
dateOpened: "2026-06-21"
dateStarted: "2026-06-22"
tags: []
---

# Realize the query (server-state) intent: UX-only intent JSON + swappable cache provider contract + FUI resource-cache block + demo

Realizing work for the #1419 placement ruling: author the query (server-state) intent JSON (UX-only surface — fetchPolicy + staleness display composing loader), the key->{data,staleness,revalidate} swappable cache provider contract (technical knobs: dedupe, freshWindow/evictAfter ms, revalidateOn, dependsOn live here, not the intent), a FUI resource-cache block (or resource-loader extension) implementing it, and a demo (keyed cache with staleness + invalidate-on-mutation). File via /new-standard. Read-path symmetric to the #1395 mutation lifecycle.

## Pre-flight (batch-2026-06-22-1510-1483) — full greenfield /new-standard build, not a batch slice → re-size 8 → 13, route to /new-standard

Claimed + ground. #1419's ruling (~85%) is **fully specified** — the intent is UX-only (`fetchPolicy`:
cache-first / network-only / cache-and-network, + staleness display composing `loader`), and the technical
knobs (`dedupe`, `freshWindow`/`evictAfter` ms, `revalidateOn`, `dependsOn`) ride a **swappable runtime-DI
cache provider** behind the `key → {data, staleness, revalidate}` contract. But realizing it is a **full
greenfield, multi-artifact /new-standard build** — nothing exists yet:

- **Net-new intent** `we:src/_data/intents/query.json` (mirrors the 48-line `we:src/_data/intents/mutation.json`
  shape; transcribable from #1419) — a clean foundational artifact.
- **Net-new contract** `we:blocks/resource-cache/contract.ts` (the `key → {data,staleness,revalidate}`
  provider + the technical knobs) + the `@webeverything/contracts/resource-cache` re-export. **No mirror** —
  #1395 (the symmetric mutation sibling) shipped only `mutation.json`, **no provider contract.ts** — so this
  is net-new design, and per the recurring rule *the `*/contract.ts` is always its own foundational slice*
  (the FUI impl can't import it until it lands).
- **Net-new FUI block** (`fui:` resource-cache, or a resource-loader extension) implementing the contract —
  cross-repo, `blockedBy` the contract slice.
- **Demo** (keyed cache + staleness + invalidate-on-mutation) — live-verify on the FUI dev server.

The card itself says **"File via /new-standard"** — that flow does the prior-art survey (TanStack Query / SWR /
RTK Query / Apollo, [research](/research/server-state-cache-lifecycle/)) + the proper slice decomposition.
Authoring a net-new standard's contract inline mid-batch would under-bake it. **Recommend routing to
/new-standard**, which decomposes into: (1) foundational **`query.json` + `resource-cache/contract.ts`**
(WE, batchable), (2) **FUI resource-cache block** (← 1), (3) **demo** (← 2). Re-sized **8 → 13** (drops from
the batch pool). Carry-forward reason: **outgrew / not-batchable-as-one** (full /new-standard build). No new
design fork (placement + UX-only line ruled by #1419). Released `open`.
