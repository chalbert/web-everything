---
type: issue
workItem: story
size: 3
parent: "658"
status: open
blockedBy: ["693", "704"]
dateOpened: "2026-06-15"
dateStarted: "2026-06-15"
tags: []
---

# Migrate data-grid + type-ahead UP to @frontierui/blocks

S2c of #658. Migrate the data-grid (DataGridBehavior, DataGridEditBehavior, registerDataGrid, registerDataGridEdit) and type-ahead (TypeAheadBehavior, index, registerTypeAhead, types) families UP to @frontierui/blocks + their tests, byte-verified against WE's copies, WITHOUT deleting WE's copies (#170 guard). Add to the S1 exports map. Independent of S2a/S2b. Leaves both trees valid.

## Blocker — missing precursor (2026-06-15, batch — attempted, released unworked)

Attempted in a batch and **released, not resolved** — a **dependency-ordering** blocker the card's scope
doesn't cover. `blocks/data-grid/DataGridBehavior.ts` imports `../renderers/data-grid/renderDataGrid`, and
the `renderers/data-grid/` render family (`renderDataGrid.ts`, `editableGrid.ts`, `__fixtures__`) is
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
