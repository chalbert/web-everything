---
kind: task
parent: "1684"
status: resolved
blockedBy: []
dateOpened: "2026-06-24"
dateResolved: "2026-06-24"
graduatedTo: 1684
tags: []
---

# webrouting slice D — URL-as-state declaration + coordinator seam contract

webrouting epic #1684 slice D: spec the per-component URL-as-state seam ratified by #1686 — router-agnostic syncedState-style slice declaration (persistence url|session|memory + namespaced key), intra-component microtask coalescing, and the optional cross-component coordinator that batches concurrent writes into one history entry. Authored as interface spec in the spec page; consumes slice C's codec on both read/write; notes the pagination urlSync migration (we:blocks/renderers/pagination/PaginationBehavior.ts). Rides resolved #1686. Blocked by slice C (#1727).

## Progress (batch-2026-06-23-1725-1665) — DONE

Slice D landed — the URL-as-state declaration + coordinator seam contract (#1686):
- `we:blocks/router/url-state.ts` — type-only contract: `UrlStatePersistence` (url|session|memory, never forced), `UrlCodec<T>` (the #1727 codec as a TS interface, shared read+write), `UrlStateSlice<T>` (namespaced key + persistence + codec + default — the per-component router-agnostic declaration), and the **optional** `UrlStateCoordinator` (batches cross-component concurrent writes into one history entry, the nuqs model). The runtime impl rides downstream to FUI.
- `we:src/_includes/project-webrouting.njk` — a **URL-as-state declaration & coordinator seam** section with the interface highlight block; documents the per-component (not central-provider) seam, the two component-side write paths sharing one codec, never-forced opt-in, popstate-is-truth, and the pagination `urlSync` migration target.
- Exported from `we:blocks/router/index.ts`.

Consumes slice C's codec (#1727) on both read/write. Cleared the stale `blockedBy: 1727`. Gate 0 errors.
