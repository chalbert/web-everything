# Renderer-block export-shape coverage — how the #927 resolver covers the 5 barrel-less renderer blocks

**Prep research for decision [#1164](/backlog/1164-renderer-block-export-shape-coverage-dir-walk-gather-vs-requ/)**
(slice of epic #904, de-buried from #927). Session: 2026-06-20.

## The question

The #927 export-shape arm compares each block's declared CEM `exports` (`we:src/_data/blocks/<id>.json`)
against the **actual** export surface of its FUI impl, resolved by a real TS program
(`checker.getExportsOfModule` over the impl's `index` barrel —
[we:scripts/check-standards.mjs:847-854](../scripts/check-standards.mjs#L847-L854)). It is **scoped to the
7 barrel blocks** because the resolver needs an enumerable *entry module* to read:

```js
const barrelBlocks = blocks.filter(
  (b) => b.implementedBy && /\/index\.ts$/.test(b.implementedBy) && Array.isArray(b.exports) && b.exports.length,
); // we:scripts/check-standards.mjs:824
```

The **5 renderer blocks** — `collection-operations` / `data-grid` / `data-table` / `pagination` /
`reorderable-list` — keep a **dir-style `implementedBy`** (`@frontierui/blocks/renderers/<id>/`, e.g.
`fui:blocks/renderers/data-grid/`) and those dirs hold **only leaf modules, no `index` barrel**
(verified 2026-06-20 — `ls fui:blocks/renderers/data-grid/` → two leaf modules + a `__fixtures__` dir,
no index barrel). So they fail the barrel-index-module filter ([we:scripts/check-standards.mjs:824](../scripts/check-standards.mjs#L824)) and are logged **un-coverable** rather
than checked ([we:scripts/check-standards.mjs:869-873](../scripts/check-standards.mjs#L869-L873)). This report decides
how the resolver covers them so the eventual `EXPORT_SHAPE_ENFORCED` flip
([we:scripts/check-standards-rules.mjs:1425](../scripts/check-standards-rules.mjs#L1425)) has no permanent
renderer blind spot.

## Finding 1 — the rule is **asymmetric**, which voids Fork A's stated downside

The pure rule (`validateBlockExportShape`,
[we:scripts/check-standards-rules.mjs:1429-1450](../scripts/check-standards-rules.mjs#L1429-L1450)) flags **only**
declared exports **absent** from the actual surface; **extras are explicitly fine** ("the impl can export
MORE — extras are fine", comment at line 1423):

```js
const missing = (b.declaredExports || []).filter((name) => !actual.has(name)); // only "declared ∉ actual"
```

The original #1164 framing lists Fork A's (dir-walk) risk as *"a dir-walk surface is looser than a curated
barrel — picks up internal helpers as exports."* Under an **asymmetric** rule that ignores extras, those
extra internal helpers **never cause a false anything** — a dir-walk surface is a strict **superset** of any
barrel surface (a barrel just re-exports a curated subset of the same leaf symbols), so dir-walk can never
produce a *false drift* a barrel would avoid. **That stated downside is largely void.** The real merit
difference lies elsewhere (Finding 3).

## Finding 2 — dir-walk is not toothless: it would already surface 3 genuine drifts

Enumerating the named exports of every leaf module (excluding `__tests__`/`__fixtures__`) per renderer dir
and comparing to the declared `exports`:

| renderer | status | declared `exports` | present in leaf walk? |
|---|---|---|---|
| `collection-operations` | active | `CollectionOperationsModule`, `CollectionOperationsBehavior`, `registerCollectionOperations` | **all 3 ✓** (`CollectionOperationsModule` is a class in `fui:blocks/renderers/collection-operations/CollectionOperationsBehavior.ts:160`) |
| `data-table` | active | `DataTableModule`, `DataTableBehavior`, `registerDataTable` | `DataTableBehavior` ✓, `registerDataTable` ✓, **`DataTableModule` ✗** |
| `pagination` | active | `PaginationModule`, `PaginationBehavior`, `registerPagination` | `PaginationBehavior` ✓, `registerPagination` ✓, **`PaginationModule` ✗** |
| `data-grid` | draft | `DataGridModule`, `DataGridBehavior`, `registerDataGrid` | **all 3 ✗** (dir ships `renderDataGrid`/`auditDataGrid`/… — none of the declared triple) |
| `reorderable-list` | draft | `reduceReorder`, `renderReorderableList`, `auditReorderableList`, `reconcileOrder`, `announce`, `initialState` | **all 6 ✓** |

So both A and B surface the **same genuine drifts** (`data-table`/`pagination` missing their `*Module`
aggregate; `data-grid` missing its whole triple) — these are real `#1165`-class findings the gate exists to
catch. Coverage value is not what separates A from B.

## Finding 3 — the real merit difference: "defined somewhere" vs "published through the entry point"

The renderer contracts already declare a **barrel-shaped** triple — `<Name>Module` / `<Name>Behavior` /
`register<Name>` — the identical convention the 7 barrel blocks expose, where `<Name>Module` is the
aggregate the **index barrel** publishes (see `fui:blocks/router/index.ts` re-exporting
`registerRouter`/`RouteOutletElement`/… — #948). For renderers the `*Module` is a class sitting in a leaf
file, with no entry point re-publishing it. The two mechanisms therefore differ on **what "the block's
public surface" means**:

- **B (curated `index` barrel):** verifies a declared export is reachable **through the block's public
  entry point** — i.e. it is genuinely part of the *published* API, not an internal symbol that happens to
  share the name. This is the same one TS-program path the 7 barrel blocks already use (`getExportsOfModule`
  over an index module) — **one uniform resolver semantic**.
- **A (directory walk):** verifies a declared export is merely **defined somewhere** in the impl dir. A
  symbol that is an internal helper, never meant to be public, satisfies the check — a **false negative** B
  catches. It also forces a **second resolver code path** (a dir gather) alongside the TS-program barrel
  path, so a block's coverage semantic depends on which path it takes, and the dir path is the looser one.

## Finding 4 — prior art: the JS/TS ecosystem defines "public surface" by **entry point**, never a dir glob

Surveyed how mainstream module-API tooling defines a package's public surface:

- **Feature-Sliced Design — Public API**: a module's public API *is* its `index` barrel; consumers import
  from the one entry point and internal details are deliberately excluded. The named failure mode — *"that
  helper you meant to keep private is now used elsewhere"* — is exactly A's false negative.
  ([feature-sliced.design/docs/reference/public-api](https://feature-sliced.design/docs/reference/public-api))
- **Microsoft API Extractor** traces all exports **from the package's main entry point** to build its API
  report; path-based imports that *"fish around in folder trees"* are explicitly **incompatible** with the
  rollup — the entry point, not the directory, defines the surface.
  ([api-extractor.com](https://api-extractor.com/pages/overview/intro/),
  [the d-ts rollup](https://api-extractor.com/pages/overview/demo_rollup/))
- **Barrel-file linters** (e.g. FSD/Nx public-API rules) enforce that *the barrel is the intentional public
  API* — re-exporting controls what is public.
  ([frontendpatterns.dev/barrel-export](https://frontendpatterns.dev/barrel-export/))

The one well-known **downside of barrels — broken tree-shaking** ([Vercel: optimizing package imports](https://vercel.com/blog/how-we-optimized-package-imports-in-next-js))
— is a **runtime bundling** concern. It does **not transfer** to a build-time conformance gate that only
*reads* the export surface and emits nothing into a bundle. So the ecosystem's reason to sometimes avoid
barrels is irrelevant here, while its reason to define the public surface *by entry point* applies directly.

## Finding 5 — C ("exempt renderers") is a prioritization choice wearing a fork's clothing

The original Fork C ("exempt renderers — the arm logs them out-of-scope") is described only as *"Cheapest;
leaves renderer export-drift unguarded."* Its sole appeal is **cost**, and its merit is strictly **worse**
(a permanent coverage hole on real `status:active` contracts whose consumers depend on
`registerDataTable`/`DataTableBehavior` resolving). By the *fork-is-not-a-prioritization-tool* rule, "do
less because it's cheaper" is **not a merit branch**. The interim reality — the flip stays scoped to the 7
barrel blocks until coverage ships — is **scheduling**, not a design end-state. So C is **demoted**: it is
the null/defer option, not a co-equal third branch. The on-merit call is **A vs B**.

## Per-fork classification (the 7-question pass)

This element is the **conformance-gate / tooling layer** (`we:scripts/check-standards.mjs` + `we:scripts/check-standards-rules.mjs`), not a
Block / Intent / Protocol / Capability — it is the *verification machinery for* the block contract. So the
intent-dimension, DI-injectability, and seam questions are **N/A**. The two questions that bind:

- **Q1 (which layer):** gate implementation — an internal mechanism choice, not a standards surface. No
  WE-published artifact and no consumer-facing knob results either way (the `EXPORT_SHAPE_ENFORCED`
  invariant is the same; only *how* a renderer's actual surface is resolved changes).
- **Governing principle:** the published-surface definition (entry point = public API, Finding 4) +
  **one uniform resolver semantic** (Finding 3). Both point to **B**.

## Recommendation

**Fork (A vs B): adopt B — add a curated `index` barrel per renderer and re-point each `implementedBy`
at it (the #948 pattern), so the resolver covers all 12 blocks through one entry-point semantic. Confidence:
med-high.** A's only advantage over B is "no FUI change," which is **cost, not merit** (its build size, not
a fork con); on merit A is strictly weaker (false-negative on internal symbols + a second looser resolver
path). The residual that keeps this a *weighed* fork rather than a bare ratify: A's coverage is
*degraded-but-functional* (it still catches the Finding-2 drifts), and a decider may legitimately use A — or
the interim barrel-scoped flip — as a **scheduling** lever while the 5 FUI barrels are prioritized. The
ruling is the end-state (B); *when* to build the 5 barrels is normal burndown ordering.

**Graduation (on ratifying B):** 5 `index` barrels under `fui:blocks/renderers/<id>/` (`locus: frontierui`) +
5 contract re-points in `we:src/_data/blocks/` + extend the §8e `barrelBlocks` filter to include them +
regenerate CEM. The `EXPORT_SHAPE_ENFORCED` flip remains gated on **#1165** (resolve the 3 barrel-block
drifts) **and** this renderer coverage.
