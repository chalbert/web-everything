---
type: issue
workItem: story
size: 3
parent: "658"
status: resolved
blockedBy: ["693", "704"]
dateOpened: "2026-06-15"
dateStarted: "2026-06-15"
dateResolved: "2026-06-15"
graduatedTo: frontierui/blocks/data-grid/DataGridBehavior.ts
tags: []
---

# Migrate data-grid + type-ahead UP to @frontierui/blocks

S2c of #658. Migrate the data-grid (DataGridBehavior, DataGridEditBehavior, registerDataGrid, registerDataGridEdit) and type-ahead (TypeAheadBehavior, index, registerTypeAhead, types) families UP to @frontierui/blocks + their tests, byte-verified against WE's copies, WITHOUT deleting WE's copies (#170 guard). Add to the S1 exports map. Independent of S2a/S2b. Leaves both trees valid.

## Blocker — missing precursor (2026-06-15, batch — attempted, released unworked)

Attempted in a batch and **released, not resolved** — a **dependency-ordering** blocker the card's scope
doesn't cover. `fui:blocks/data-grid/DataGridBehavior.ts` imports `../renderers/data-grid/renderDataGrid`, and
the `renderers/data-grid/` render family (`fui:renderDataGrid.ts`, `fui:editableGrid.ts`, `__fixtures__`) is
**WE-only — not yet in `@frontierui/blocks`** (`../frontierui/blocks/renderers/data-grid/` is absent). A
byte-identical copy of data-grid would therefore have a **dangling import** and fail FUI's build, breaking
"leaves both trees valid". (The other deps — `plugs/webbehaviors/CustomAttribute{,Registry}` — *do* exist
in FUI, so those resolve.)

Type-ahead's deps are satisfied (only `plugs/webbehaviors`), but the card bundles data-grid + type-ahead as
one slice, so it can't fully land while data-grid is blocked.

**Unblock:** add a precursor slice — **migrate `blocks/renderers/data-grid/` up to `@frontierui/blocks`
first** (byte-identical, the same #170 pattern as #694/#695), then S2c is a clean byte-copy. Recommend
scaffolding that as S2c-pre (a `task` under #658) and setting `#696 blockedBy: [<that>]`. The latent type
issue #695 hit may also recur in these families — apply the same option-A type-harden if the FUI build
flags one.

## Progress

- **2026-06-15 — migrated (the S2c-pre #704 unblocked it).** Byte-identical copies UP to
  `@frontierui/blocks`: the **data-grid** family (`DataGridBehavior`, `DataGridEditBehavior`,
  `registerDataGrid`, `registerDataGridEdit`) + the **type-ahead** family (`TypeAheadBehavior`, `index`,
  `registerTypeAhead`, `types`), plus their unit tests (data-grid ×2 + type-ahead ×1). All 11 files
  `diff`-verified byte-identical; WE copies untouched (#170). data-grid's `../renderers/data-grid/...`
  import now resolves (the #704 precursor); the `plugs/webbehaviors` deps already existed in FUI.
- **Exports map:** added named + wildcard entries for both new top-level families (`./data-grid` →
  `fui:registerDataGrid.ts`, `./type-ahead` → `we:index.ts`, plus `./data-grid/*`, `./type-ahead/*`), per #694.
- **Type-harden (#695 option-A, as the card anticipated):** FUI's stricter `strictFunctionTypes` flagged
  `fui:DataGridEditBehavior.ts` — `editor` is an `EditorElement` union, so the typed `keydown` overload
  doesn't resolve and `addEventListener` falls back to the base `EventListener` signature, which a
  `(KeyboardEvent)=>void` handler isn't assignable to. Cast the handler `as EventListener` at the
  add/remove sites, applied **byte-identically to both copies** (WE + FUI). Runtime-identical.
- **Gate:** FUI `tsc -p fui:blocks/tsconfig.json --noEmit` clean; FUI data-grid + type-ahead suites 63/63
  green; WE `check:standards` 0 errors + WE DataGridEditBehavior 31/31 green. Both trees valid.
