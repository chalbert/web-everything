---
kind: task
parent: "1684"
status: open
blockedBy: ["1727"]
dateOpened: "2026-06-24"
tags: []
---

# webrouting slice D — URL-as-state declaration + coordinator seam contract

webrouting epic #1684 slice D: spec the per-component URL-as-state seam ratified by #1686 — router-agnostic syncedState-style slice declaration (persistence url|session|memory + namespaced key), intra-component microtask coalescing, and the optional cross-component coordinator that batches concurrent writes into one history entry. Authored as interface spec in the spec page; consumes slice C's codec on both read/write; notes the pagination urlSync migration (we:blocks/renderers/pagination/PaginationBehavior.ts). Rides resolved #1686. Blocked by slice C (#1727).
