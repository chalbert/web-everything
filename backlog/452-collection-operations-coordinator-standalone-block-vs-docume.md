---
type: decision
workItem: story
size: 2
status: resolved
dateOpened: "2026-06-12"
dateStarted: "2026-06-13"
dateResolved: "2026-06-13"
graduatedTo: none
preparedDate: "2026-06-13"
tags: [collection-operations, data-table, pagination, composition, block, design-decision]
relatedProject: webblocks
relatedReport: reports/2026-06-13-collection-operations-coordinator.md
crossRef: { url: /intents/collection-operations/, label: collection-operations intent }
---

# Collection-operations coordinator: standalone block vs documented composition

**Grounding.** Carved off **#369** (the coordinator gap app A hit composing data-table + pagination
over a 5k-row collection); the build can't proceed until its home is chosen. This is mostly
**ratify-shipped-code** — `applyPipeline`, `DataTableBehavior` and `PaginationBehavior` already ship;
the only gap is the missing *seam owner* between them. The owed prior-art pass is published at
[/research/collection-operations-coordinator](/research/collection-operations-coordinator/) (report:
[2026-06-13-collection-operations-coordinator.md](reports/2026-06-13-collection-operations-coordinator.md)),
and it **reshaped the item from one fork into two**: the home question (block vs composition) is
near-unanimous in the industry, but a second axis the item didn't name — *what shape* the standalone
primitive takes — is where the real signal sits. **Two forks below, each with a bold recommended
default.**

## Ruling (2026-06-13) — A / A

Both forks ratified to **A**; the B branches fail the fork-existence test (each is flawed, not a
legitimate alternate end-state), so this is a crisp call, not "support both".

- **Fork 1 — home: A · a standalone coordinator primitive.** The filter→sort→group→page coordination
  is owned in one place, not hand-wired per consumer. *B rejected:* "wire it yourself" institutionalises
  exactly the #369 footgun (sort/filter apply only to the current page) and is the one shape no surveyed
  grid (TanStack, AG Grid, MUI) recommends.
- **Fork 2 — shape: A · a headless `CollectionOperationsBehavior` + optional `<collection-operations>`
  element wrapper.** Mirrors the shipped `DataTableBehavior`/`DataTableElement` + `PaginationBehavior`
  convention and the dominant headless-instance home (TanStack "table instance", AG Grid "row model").
  *B rejected:* a rendered block implies owned markup the coordinator doesn't have — it would either
  duplicate the table/pagination DOM (MUI fused-monolith) or render nothing (dead scaffold), violating
  compose-don't-merge.
- **Sub-decision (defaulted):** ship the `<collection-operations>` element wrapper **in the same slice**
  as the behavior, for parity with `registerDataTable`/`DataTableElement`.
- **Non-forks upheld:** client (in-memory `applyPipeline`) vs server (params → Loader) execution is a
  runtime strategy (Technical Configurator), both supported, default to whichever the wiring implies;
  **page-as-terminal-stage over the whole set stays a fixed mechanic** (exposing page-then-sort just
  re-enables #369's bug). Compose-don't-merge: the page stage stays owned by pagination's `PageState`.

**Lands in** `blocks/renderers/collection-operations/` (WE reference layer; richer impl —
virtualization, very large sets — → FUI). **Unblocks the #369 build:** subscribe to `data-table-change`
+ `pagination-change`, re-run `applyPipeline` + the page stage over the *full* set, re-window, push the
current slice to the table and totals to pagination. No new protocol/intent — the coordinator is the
runtime of the existing `collection-operations` intent.

## Axis framing

The concern decomposes into two orthogonal axes plus one already-settled non-fork:

- **Axis 1 — home.** Does the filter→sort→group→page coordination get its own primitive, or stay a
  documented pattern each consumer wires? The wiring is identical for every consumer and getting the
  stage order wrong *is* #369's bug: data-table's `applySortClick` sorts only the rows it was handed,
  and `applyPipeline` deliberately **no-ops the page stage** ("it is the Pagination block's job —
  compose, never merge") — [renderDataTable.ts:143-173](blocks/renderers/data-table/renderDataTable.ts#L143).
  So someone must run the *whole* pipeline over the full set, then hand the current slice to the table.
- **Axis 2 — shape.** *If* it's a primitive (Axis 1 = A), is it a rendered **block** (markup of its
  own) or a headless **behavior** (no markup; orchestrates the two blocks that have markup)? WE already
  ships both halves as headless behaviors with optional element wrappers:
  [DataTableBehavior.ts:26-104](blocks/renderers/data-table/DataTableBehavior.ts#L26) emits
  `data-table-change`; [PaginationBehavior.ts:1-12](blocks/renderers/pagination/PaginationBehavior.ts#L1)
  owns `PageState` and emits `pagination-change` "so a consumer can re-window its collection". The
  survey found the dominant industry home is exactly this headless-instance shape (TanStack "table
  instance", AG Grid "row model"), not a rendered monolith and not docs-only.
- **Non-fork — execution strategy.** Client (in-memory `applyPipeline`) vs server (params → Loader) is
  **not** a decision: the collection-operations intent is **UX-only** (`src/_data/intents.json`
  `collection-operations`), so the coordinator picks the strategy at runtime — it ties to the Technical
  Configurator. Both supported by default; most-permissive default (client when the full set is in
  memory, server when a Loader is wired). See *Not a fork* below.

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **1 — home** | **A · a standalone coordinator primitive** | B · documented composition (+ helper) | High — industry unanimous; B *is* the #369 footgun |
| **2 — shape of the primitive** | **A · headless `CollectionOperationsBehavior` + optional `<collection-operations>` element wrapper** | B · a rendered coordinator block | High — mirrors two shipped WE behaviors + the dominant headless-instance pattern |

## Fork 1 — home: standalone primitive vs documented composition

**Crux.** Where does the coordinator that runs filter → sort → group → **page** over the *whole*
collection live? Today the consumer hand-wires page-then-render, so sort/filter apply only to the
current page ([#369](/backlog/369-collection-operations-coordinator/), lines 14-21).

- **A — a standalone coordinator primitive (default).** Own the pipeline once: consume
  `data-table-change` (sort/filter) + `pagination-change` (page) events, re-run `applyPipeline` + the
  page stage over the full set, re-window, push the current slice to the table and totals to
  pagination. The wiring is identical for every consumer, so baking it once beats every app re-deriving
  the filter→sort→group→page order. Adds a primitive but removes the footgun. **Every surveyed grid
  (TanStack, AG Grid, MUI) owns coordination in one place; none ships docs-only.**
- **B — a documented composition (+ maybe a helper).** Ship only a documented pattern the consumer
  assembles from the existing blocks. Lighter (no new primitive), but every consumer re-implements the
  same wiring and can get the stage order wrong — *the exact bug #369 reports*.

**Default: A.** The recurring, identical wiring is precisely what earns its own home
(bias toward separation/decoupling — a concept that recurs the same way for everyone), and the
industry is unanimous that this coordination is owned, not hand-wired.

*Rejected — B:* it institutionalizes the #369 footgun; "wire it yourself" is the one approach no
leading library recommends.

*Note — not a reopening of #036:* #036 (resolved → the `pagination` block,
`graduatedTo: block:pagination`) realized only the **page** dimension; it does **not** own this
cross-block coordinator. A is a *new* primitive, not a reopening
([036-collection-operations-block-implementation.md](/backlog/036-collection-operations-block-implementation/)).

## Fork 2 — shape: headless behavior vs rendered block

**Crux (surfaced by the survey).** Given Fork 1 = A, what *shape* is the primitive? The coordinator
has **no DOM of its own** — it orchestrates two blocks that do — so "block" (a renderer + audit +
markup) may be the wrong mold.

- **A — a headless coordinator behavior (default).** `CollectionOperationsBehavior` (working name) owns
  the full pipeline over the single collection, subscribes to `data-table-change` +
  `pagination-change`, re-runs `applyPipeline` + the page stage, re-windows, and pushes results back —
  with an optional `<collection-operations>` custom-element wrapper. This **mirrors the shipped
  `DataTableBehavior`/`DataTableElement` and `PaginationBehavior` convention exactly**, and matches the
  dominant industry home (TanStack "table instance", AG Grid "row model" — headless instances that own
  the pipeline and delegate rendering). Compose-don't-merge: the page stage stays owned by pagination's
  `PageState` ([renderPagination.ts:26-57](blocks/renderers/pagination/renderPagination.ts#L26)); the
  coordinator owns only the *order* + re-windowing.
- **B — a rendered coordinator block.** Mint a full block (renderer + audit + DOM). Heavier, and it
  has no markup to render — it would either duplicate the table/pagination DOM (MUI's fused-monolith
  shape, the opposite of WE's compose style) or render nothing, making the block scaffold dead weight.

**Default: A.** A headless behavior is the WE-idiomatic and industry-dominant shape; the element
wrapper ships in the same slice for parity with data-table/pagination (one small primitive, no new
block-page scaffold).

*Rejected — B:* a "block" implies owned markup the coordinator doesn't have; forcing the block mold
either duplicates DOM or fuses the two blocks into a monolith, violating compose-don't-merge.

*Sub-decision (low-risk, defaulted):* ship the `<collection-operations>` **element wrapper in the same
slice** as the behavior, mirroring `registerDataTable`/`DataTableElement`. Alternative — behavior-only,
add the element later — is available if the build wants to stage it, but parity argues for together.

## Not a fork (supported by default)

**Client-side (in-memory pipeline) vs. server-driven (params → Loader)** is *not* a decision: the
collection-operations intent is **UX-only**, so the coordinator picks the strategy at runtime and both
are supported — it ties to the Technical Configurator, it doesn't fork the design. `applyPipeline`
already exists for filter/sort/group; the coordinator adds the page stage + event wiring + optional
Loader integration for server-side pipelines. Most-permissive default: client when the full set is in
memory, server when a Loader is wired.

## Per-fork classification (the 7-question pass)

Applied to the coordinator primitive (full detail in the
[report](reports/2026-06-13-collection-operations-coordinator.md)):

1. **Layer:** reference behavior + element in WE `blocks/renderers/collection-operations/` (where
   data-table/pagination behaviors already live); richer impl (virtualization, very large sets) → FUI.
2. **Protocol/intent dimension:** neither new — the `collection-operations` intent already exists and
   declares `pipelineOrder`; the coordinator is its *runtime*, not a new protocol or dimension.
3. **Expose the whole axis:** client-vs-server is a runtime strategy (Technical Configurator), so the
   whole execution axis is supported, not forked.
4. **Fixed mechanic vs dimension:** stage *order* is already configurable (`config.order`);
   **page-as-terminal-stage over the whole set is a fixed mechanic** (every surveyed library enforces
   it — exposing page-then-sort only re-enables #369's bug).
5. **DI-injectable:** yes — execution strategy is injectable; ambient defaults (page size, collation)
   ride the intent DI channel.
6. **Most-permissive default:** support both client and server; default to whichever the wiring implies.
7. **Seam between intents:** sits at collection-operations × pagination/windowed-collection × loader;
   **orchestrates, does not merge** — the page stage stays in the pagination block. Bias toward
   separation upheld: a thin orchestrator, not a super-block.

## Concrete refs

- [369-collection-operations-coordinator.md](/backlog/369-collection-operations-coordinator/) — the
  gap + open questions (lines 31-37); `blockedBy: ["452"]`.
- [036-collection-operations-block-implementation.md](/backlog/036-collection-operations-block-implementation/)
  — resolved; graduated to the `pagination` block (page dimension only), `graduatedTo: block:pagination`.
- `applyPipeline` (page stage no-op by design):
  [blocks/renderers/data-table/renderDataTable.ts:143-196](blocks/renderers/data-table/renderDataTable.ts#L143).
- Headless behavior convention to mirror:
  [DataTableBehavior.ts:26-104](blocks/renderers/data-table/DataTableBehavior.ts#L26),
  [PaginationBehavior.ts:1-12](blocks/renderers/pagination/PaginationBehavior.ts#L1).
- Prior-art survey: [report](reports/2026-06-13-collection-operations-coordinator.md) ·
  [/research/ topic](/research/collection-operations-coordinator/).
- Surfaced by app A: [#317](/backlog/317-exercise-app-loan-origination/).
