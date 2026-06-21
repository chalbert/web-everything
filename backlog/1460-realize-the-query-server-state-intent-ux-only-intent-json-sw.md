---
kind: story
size: 8
status: open
blockedBy: ["1419"]
dateOpened: "2026-06-21"
tags: []
---

# Realize the query (server-state) intent: UX-only intent JSON + swappable cache provider contract + FUI resource-cache block + demo

Realizing work for the #1419 placement ruling: author the query (server-state) intent JSON (UX-only surface — fetchPolicy + staleness display composing loader), the key->{data,staleness,revalidate} swappable cache provider contract (technical knobs: dedupe, freshWindow/evictAfter ms, revalidateOn, dependsOn live here, not the intent), a FUI resource-cache block (or resource-loader extension) implementing it, and a demo (keyed cache with staleness + invalidate-on-mutation). File via /new-standard. Read-path symmetric to the #1395 mutation lifecycle.
