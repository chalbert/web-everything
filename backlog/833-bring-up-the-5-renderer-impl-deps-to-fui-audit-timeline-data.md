---
type: issue
workItem: story
size: 3
parent: "823"
status: resolved
dateOpened: "2026-06-17"
dateStarted: "2026-06-17"
dateResolved: "2026-06-17"
graduatedTo: frontierui/blocks/renderers/index.ts
locus: frontierui
tags: []
---

# Bring up the 5 renderer-impl deps to FUI (audit-timeline, data-table, decision-trace, pagination, status-indicator)

Migrate the 5 renderer-impl families the two exercise apps compose UP to @frontierui/blocks/renderers, byte-verified per the #170 guard, WE copies kept (WE keeps the renderer demos). Today blocks/renderers/ in FUI holds only data-grid + index.ts; the apps import ../../blocks/renderers/{audit-timeline,data-table,decision-trace,pagination,status-indicator}. Add the 5 to blocks/renderers/index.ts. FUI-only; no app yet, no delete. Foundational slice of #823 (#812 Fork-1(a)).

## Progress

**Resolved 2026-06-17 (batch-2026-06-17). Locus: frontierui.**

- **Brought up 5 families byte-identical** — `audit-timeline`, `data-table`, `decision-trace`, `pagination`, `status-indicator` copied from WE `blocks/renderers/` to `@frontierui/blocks/renderers/` (incl. each `__fixtures__`). `diff -rq` confirms every directory is **byte-identical** WE⟷FUI per the #170 duplication guard; WE copies kept (no delete). All cross-family imports resolve in FUI: `audit-timeline` → `../../audit/AuditProvider` (already present in FUI, type-only import), `data-table`/`decision-trace` → the sibling `status-indicator` renderer (now co-present).
- **Barrel exports** — added the five families' public entry points to `blocks/renderers/index.ts` (render fns + HTML serializers + behaviors/elements + their option/config types), alongside the existing `jsx`/`data-grid`. Verified with a targeted `tsc --noEmit` on the barrel (caught + fixed a duplicate `PageMode`/`Advance`/`UrlSync`/`RangeLabel` re-export — those types live in `renderPagination`, not `PaginationBehavior`); barrel now typechecks clean.
- **Gate** — FUI `npm run check:standards` green (0/0). No app moved and nothing deleted (that is the #823 app-move slice); this is purely the dependency bring-up.

`graduatedTo` → `frontierui/blocks/renderers/index.ts`.
