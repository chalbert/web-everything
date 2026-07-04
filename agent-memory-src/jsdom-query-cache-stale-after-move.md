---
name: jsdom-query-cache-stale-after-move
description: "In jsdom, querySelectorAll/children go stale after an in-place insertBefore move; assert DOM order/count via childNodes"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 3245dbf2-d974-4ad8-8441-03e104f61ca4
---

In jsdom (FUI's vitest env), calling `insertBefore(node, ref)` on a node that is **already a child**
corrupts the parent's `querySelectorAll(...)` and `.children` (live HTMLCollection) caches — they return a
**stale count and order** (e.g. a moved-not-added node reads as a duplicate). `childNodes` always reflects
the real tree. The actual DOM mutation is correct; only those two query surfaces lie.

**Why:** cost me a long false-positive debug on #2002 (keyed ForEach reconciliation) — a reorder that was
provably correct (verified via `childNodes`) looked like it duplicated/failed to reorder because the test
asserted through `querySelectorAll('.item')`.

**How to apply:** (1) In FUI DOM-reconciliation/reorder/portal tests, read stamped nodes via
`[...container.childNodes].filter(...)`, never `querySelectorAll`/`.children`, when the code under test
does in-place moves. (2) In production reconcilers, make reorders **minimum-move** (skip an
already-correctly-positioned node) — this is both faster and sidesteps the cache bug; see
`fui:blocks/for-each/ForEachBehavior.ts` `#reconcile`. Recurs for any keyed-list / reorder / [[moveBefore]]
test in jsdom.
