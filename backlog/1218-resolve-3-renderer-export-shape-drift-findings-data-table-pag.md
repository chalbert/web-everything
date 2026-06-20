---
kind: decision
size: 3
parent: "904"
status: resolved
blockedBy: []
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: none
codifiedIn: "docs/agent/platform-decisions.md#export-shape-drift"
preparedDate: "2026-06-20"
tags: [export-shape-drift, renderers, frontierui]
---

# Resolve 3 renderer export-shape drift findings (data-table / pagination / data-grid)

Surfaced by #1203 (the curated-barrel slice): 3 of the 5 renderers cannot get a clean named-re-export
barrel because their FUI impl drifts from the declared `we:` CEM `exports`. Same class as the **ratified**
#1165 — apply its codified axis (`we:docs/agent/platform-decisions.md#export-shape-drift`): *for every
declared-but-absent symbol, one binary on merit — **load-bearing to the block's coherent surface → build
(or align names); additive/superseded/aspirational over a complete core → trim**. Cost never decides a
fork; it only prioritizes a spawned build.* All 3 blocks are `type: Module` (they declare the
`*Module`/`*Behavior`/`register*` custom-element triad as canonical).

## Findings (verified 2026-06-20)

| renderer | declared `we:` `exports` | actual FUI exports (`fui:blocks/renderers/<id>/`) | drift |
| --- | --- | --- | --- |
| `data-table` | `DataTableModule` · `DataTableBehavior` · `registerDataTable` | `DataTableBehavior` · **`DataTableElement`** · `registerDataTable` (`fui:blocks/renderers/data-table/DataTableBehavior.ts`) | element class shipped as `*Element`, contract says `*Module` — **pure rename** |
| `pagination` | `PaginationModule` · `PaginationBehavior` · `registerPagination` | `PaginationBehavior` · **`PaginationElement`** · `registerPagination` (`fui:blocks/renderers/pagination/PaginationBehavior.ts`) | same `*Element`-vs-`*Module` rename |
| `data-grid` | `DataGridModule` · `DataGridBehavior` · `registerDataGrid` | **attribute-built, split across two dirs** — `DataGridBehavior` (a *default*-exported `CustomAttribute` `grid:cell-navigation`) + `registerDataGrid` in `fui:blocks/data-grid/`; `renderDataGrid` · `auditDataGrid` · `editableGrid` helpers in `fui:blocks/renderers/data-grid/`; **no `*Module` element class anywhere** (grep: 0 `extends HTMLElement` / 0 `customElements.define` for the grid) | only the **`DataGridModule` element** is genuinely absent — the behavior+registrar exist, but as an *attribute* behavior (not the named coordinator the contract/siblings declare) and in an unbarrelled location |

> **Finding correction (2026-06-20, post-claim grounding).** The original data-grid row called it
> "functional-only, the whole triad absent." That was wrong: `DataGridBehavior` + `registerDataGrid` **exist**
> in `fui:blocks/data-grid/` (verified by grep), just as a `CustomAttribute` rather than the element-wrapper
> triad. What's truly absent is only the `DataGridModule` element. This correction does not change the Fork B
> verdict (still B1 — build the element), but it reshapes the build into a thin element wrapping the existing
> behavior + a location/naming reconciliation, not a from-scratch triad.

Note the deviation direction: `collection-operations` (the family's clean case) ships
`CollectionOperationsModule` — so `*Module` is the family convention and `data-table`/`pagination` are the
deviants, not the contract.

## Fork A — `data-table` + `pagination`: a name-alignment call (not build-vs-trim)

The custom element **exists** in both; only the name differs (`*Element` vs the declared `*Module`). Not
load-bearing-absent, so neither "build" nor "trim the surface" applies — it is a one-line *rename on one
side*. The merit question is only **which name is canonical**.

- **A1 — Rename the impl `*Element` → `*Module` (`locus: frontierui`). [DEFAULT, ~70%]** Restores family
  consistency: `collection-operations` already ships `*Module`, the blocks are `type: Module`, and the
  contract declares `*Module`. The two renderers are the outliers; align them to the family rather than
  entrench the deviation. A small mechanical rename (class + `register*` default tag references + tests).
- **A2 — Correct the contract `DataTableModule`→`DataTableElement` / `PaginationModule`→`PaginationElement`
  (`we:` edit).** The #1165 pure-rename precedent (`ViewEngineOptions`→`ViewOptions`) corrected the
  *contract* to the shipped name — cheapest, no FUI churn. Excluded as default only because it entrenches a
  per-renderer naming split against the `*Module` family convention.

**Default A1**, ~70%. Residual: if the `*Element` suffix is actually the intended house style going forward
(and `collection-operations` is the outlier), flip to A2 and rename `collection-operations` instead — a
naming-convention call worth one line of confirmation.

## Fork B — `data-grid`: build the element triad vs trim to functional-only

A genuine either/or. `data-grid` is `type: Module` and declares `DataGridModule`/`DataGridBehavior`/
`registerDataGrid`, but FUI built it **functional-only** (`renderDataGrid` + `auditDataGrid` + the
`editableGrid` keyboard/editing helpers) — no registered element at all.

- **B1 — Build the `DataGridModule`/`DataGridBehavior`/`registerDataGrid` triad in FUI (`locus:
  frontierui`, under #904). [DEFAULT, ~60%]** Per the codified axis: the element triad is load-bearing to
  coherence — every sibling renderer (`data-table`, `pagination`, `collection-operations`) ships it, the
  block is `type: Module`, and a functional renderer with no registered element is the odd one out. Mirrors
  #1165's Fork-3 `view` build verdict (#1217): a real designed surface FUI hasn't built yet → file the
  build, the export-shape warning persists on those 3 symbols until it lands.
- **B2 — Trim the contract to the functional surface** (`exports` → `["renderDataGrid", "auditDataGrid",
  …]`, drop the triad, retype the block away from `Module`). Correct only if data-grid is *deliberately* a
  pure render-function renderer with no custom-element wrapper. Excluded as default because nothing in the
  block's design states that, and it would make data-grid inconsistent with its whole family.

**Default B1**, ~60%. Residual (the real one): whether data-grid is intended as a registered element like
its siblings or as an intentionally headless render function — its `designDecisions` don't say outright.
Worth the skeptic pass before ratifying; if headless-by-intent, B2.

---

**On resolve:** A "rename"/"build" verdict spawns a `locus: frontierui` story under #904; a "trim"/"correct
contract" verdict edits the renderer's `we:src/_data/blocks/<id>.json` `exports` in place. Once each
renderer's surface is reconciled, its curated barrel (#1203) is a trivial follow-up — **#1203 is `blockedBy`
this item**. Sibling of the ratified #1165; cites its codified axis, does not re-litigate it.

---

## Ruling — RATIFIED 2026-06-20 (A1 + B1)

Applies the codified axis `we:docs/agent/platform-decisions.md#export-shape-drift` (the #1165 precedent);
coins no new rule.

- **Fork A → A1 (~80%):** rename the impl `*Element` → `*Module` for `data-table` and `pagination`. The
  element class exists in both (`DataTableElement`/`PaginationElement`, both `extends HTMLElement`); only the
  name deviates from the declared `*Module` and the `CollectionOperationsModule` family convention. Contract
  stays the source of truth; impl aligns to it. (Rejected A2 = correcting the contract to `*Element`, even
  though it is the *cheaper* branch — cost does not decide a fork. A family-wide `*Module`→`*Element`
  reconvention remains a separate, out-of-scope call.)
- **Fork B → B1 (~70%):** build the `DataGridModule` element triad in FUI. The element is load-bearing to the
  family's coherent surface (every sibling ships one; the block is `type: Module`); nothing in the design
  states headless-by-intent. **Red-team note:** the prepared turn briefly reversed to B2 on the block's
  `composesFocusDelegation` design decision — but that governs the *internal* roving-focus engine, not the
  *distribution shape* (data-table also composes behaviors yet ships an element), so it is orthogonal and B2
  loses its only grounding. The behavior+registrar already exist as a `CustomAttribute`, so B1 is a thin
  element wrapper + location/naming reconciliation, not a from-scratch build.

**Fork-merit note.** Both defaults pick the *more expensive* branch on merit (A1 over the one-line A2; B1
over the one-line B2-trim); cost only prioritizes the spawned builds, never the fork.

**Supersedes #1205** (concurrent-session duplicate covering the identical three `*Module` drifts; its "exist
NOWHERE / grep=0" grounding was wrong for `data-table`/`pagination`, which ship `*Element`). #1205 resolved as
superseded-by this item; its implied builds are the two stories spawned here.

**Spawned (both `locus: frontierui`, under #904):**

- **#1229** — rename `DataTableElement`→`DataTableModule` + `PaginationElement`→`PaginationModule` (A1).
- **#1230** — build the `DataGridModule` element triad wrapping the existing `grid:cell-navigation`
  behavior (B1).

The export-shape warning persists on the 3 `*Module` symbols until those land. **#1203 (curated barrels) is
unblocked** by this resolution.
