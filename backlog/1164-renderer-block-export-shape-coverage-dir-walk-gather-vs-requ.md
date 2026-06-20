---
type: decision
workItem: story
size: 3
parent: "904"
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: none
codifiedIn: one-off
preparedDate: "2026-06-20"
relatedReport: reports/2026-06-20-renderer-export-shape-coverage.md
tags: []
---

# Renderer-block export-shape coverage: dir-walk gather vs require FUI barrels vs exempt

**Prepared (2026-06-20).** De-buried from #927 (which left this as "decide it when (b) lands"). The #927
export-shape arm verifies the 7 **barrel** blocks but logs the **5 renderer blocks** —
`collection-operations` / `data-grid` / `data-table` / `pagination` / `reorderable-list` — as
**un-coverable**, because their dir-style `implementedBy` (`@frontierui/blocks/renderers/<id>/`) ships only
leaf modules with **no `index` barrel** for the TS-program resolver to enumerate. The fork below is
grounded in a prior-art survey published as
[`/research/renderer-export-shape-coverage/`](/research/renderer-export-shape-coverage/) (session report
`we:reports/2026-06-20-renderer-export-shape-coverage.md`), and carries a recommended default in **bold**.

The decision turns on **one axis: what defines a renderer block's "actual export surface"** that the
resolver compares the declared CEM `exports` against. The gate today reads it from an *entry-point barrel*
via `checker.getExportsOfModule`
([we:scripts/check-standards.mjs:847-854](../scripts/check-standards.mjs#L847-L854)), filtered to
`implementedBy` ending in a barrel `index` module
([we:scripts/check-standards.mjs:824](../scripts/check-standards.mjs#L824)); the pure rule flags only
declared exports **absent** from that surface — extras are explicitly fine
([we:scripts/check-standards-rules.mjs:1441](../scripts/check-standards-rules.mjs#L1441)). The renderers
already declare a barrel-shaped `<Name>Module`/`<Name>Behavior`/`register<Name>` triple (e.g.
`we:src/_data/blocks/data-table.json`), the same convention the barrel blocks publish from their index —
implying a barrel was the intended shape.

### Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| 1 — how the resolver covers renderers | **B — add a curated `index` barrel per renderer + re-point `implementedBy` (the #948 pattern)** | A — dir-walk the leaf modules | med-high |

## Fork 1 — how the resolver defines a renderer block's actual export surface

**Why this is a fork (real either/or):** the resolver must adopt **exactly one** definition of a renderer
block's "actual export surface," and A (the union of every leaf module's exports) vs B (the symbols
re-exported through a curated entry point) are **mutually-exclusive** definitions that *disagree on whether
an internal-only symbol counts as a declared public export* — they cannot both be the rule. (C is not a
third branch — see *Rejected*.)

**Crux** (`we:scripts/check-standards.mjs:816-873`, `we:scripts/check-standards-rules.mjs:1429-1450`): the
arm needs an enumerable surface per renderer dir (`fui:blocks/renderers/<id>/`, no `index` barrel today —
verified 2026-06-20). Both A and B surface the **same** genuine drifts — empirically `data-table` &
`pagination` declare a `*Module` their leaf files don't export, and draft `data-grid` declares its whole
triple absent (report Finding 2) — so coverage value does **not** separate them. The difference is the
*definition of public surface* (report Finding 3) + uniformity of the resolver.

- **A — dir-walk the leaf modules.** Resolver enumerates every leaf module under the renderer dir and unions
  their named exports; keeps `implementedBy` dir-style, no FUI change. *Merit downside:* verifies a declared
  export is merely **defined somewhere**, so an internal helper sharing a declared name passes (a **false
  negative** B catches); and it adds a **second, looser resolver path** alongside the barrel TS-program
  path, so a block's coverage semantic depends on which path it takes. (The original "dir-walk picks up
  internal helpers as exports → false positives" worry is **void** — the rule ignores extras; report
  Finding 1.)
- **B — add a curated `index` barrel under `fui:blocks/renderers/<id>/` per renderer, then re-point each
  `implementedBy` at it (the #948 pattern).** *Merit:* verifies a declared export is reachable **through the
  block's public entry point** — genuinely *published* API, not an internal symbol — and reuses the **one
  uniform** `getExportsOfModule` path the 7 barrel blocks already take. Matches how the entire JS/TS
  ecosystem defines a module's public surface (Feature-Sliced Design, API Extractor, barrel linters — report
  Finding 4). *Cost (not a fork con):* 5 FUI `index` barrels + 5 contract re-points — lives on the build
  item's `size`, separately prioritized.

**Recommended default: B** (med-high). A's only advantage over B is "no FUI change," which is **cost, not
merit** — stripped from the on-merit call per *fork-is-not-a-prioritization-tool*. On merit B is strictly
stronger (correct public-surface semantic + one uniform resolver path), and it matches the ecosystem's
entry-point definition of a public API. *Residual (why a weighed fork, not a bare ratify):* A's coverage is
degraded-**but-functional** (it still catches the Finding-2 drifts), so a decider may legitimately use A —
or the interim barrel-scoped flip — as a **scheduling** lever while the 5 FUI barrels are prioritized; the
ruling is the end-state (B), the *schedule* is ordering.

- **C — exempt renderers from the arm (logged out-of-scope). *Rejected.*** Its only appeal is "cheapest";
  its merit is strictly worse — a **permanent coverage hole** on real `status:active` contracts whose
  consumers depend on `registerDataTable`/`DataTableBehavior` resolving. "Do less because cheaper" is
  prioritization, not a merit branch; the interim "flip stays barrel-scoped until coverage lands" is
  scheduling, not a design end-state (report Finding 5).

---

## Ruling (ratified 2026-06-20) — **B**: curated per-dir barrel + re-point, named re-exports only

**Fork 1 → B.** A renderer block's "actual export surface" is the symbols re-exported through a **curated
per-dir barrel** (one per renderer, e.g. `fui:blocks/renderers/data-table/index.ts`) — *published* API, not "defined somewhere." Renderers re-point their
`implementedBy` at it and ride the **one uniform** `getExportsOfModule` TS-program path the 7 barrel blocks
already take. A (dir-walk) rejected on merit: its only edge is "no FUI change" (cost, not merit, per
*fork-is-not-a-prioritization-tool*), and it forks the resolver into a second looser semantic. C (exempt)
rejected (permanent coverage hole). B′ (re-point at the existing `fui:blocks/renderers/index.ts` family
barrel) is a **scheduling shortcut only** (union-imprecise + excludes draft `data-grid`), never the end-state.

**Anti-drift is part of the ruling** (per the discussion): **named re-exports only — never `export *`**.
That makes B drift-proof both ways — compiler (TS2305) locks barrel→impl, the enforced §8e arm locks
contract→barrel. Subset semantics kept uniform (extras allowed), *not* exact-match. Confidence: high.

**Graduation** (composition order, carved to the items below): 5 FUI barrels → 5 `implementedBy` re-points
+ §8e filter extension → resolve the surfaced renderer `*Module` drifts → then the `EXPORT_SHAPE_ENFORCED`
flip (also gated on #1165).

## Grounding update (verified 2026-06-20, at claim)

The prepared body said the renderer dirs have **no** enumerable barrel. Half-true and it matters:

- **No *per-dir* barrel** (`fui:blocks/renderers/data-table/index.ts` etc. — confirmed absent). ✓ as stated.
- **But a *parent* barrel already exists** — [`fui:blocks/renderers/index.ts`](../../frontierui/blocks/renderers/index.ts)
  re-exports the published triple of **4 of the 5** renderers: `collection-operations`, `data-table`,
  `pagination`, `reorderable-list` (the exact `<Name>Behavior`/`register<Name>` symbols + render fns).
  `data-grid` is **not** re-exported (leaf `DataGridBehavior`/`registerDataGrid` exist but unpublished — a draft).

Two consequences:
1. **The genuine drifts are confirmed real:** `DataTableModule`, `PaginationModule`, `DataGridModule` exist
   **nowhere** in `fui:blocks/` (grep = 0); `CollectionOperationsModule` is present. The contract's `*Module`
   naming is the drift — surfaces the moment coverage lands (resolved under #1165's sibling space, renderer arm).
2. **A cheaper variant of B appears — B′: re-point each `implementedBy` at the *existing* parent barrel**
   (`fui:blocks/renderers/index.ts`), zero new FUI files. *But it's union-imprecise:* all 5 would resolve against one
   shared surface, so a block declaring a *sibling's* symbol would wrongly pass — it loses the per-block
   isolation that is B's whole merit. So B′ is a **scheduling shortcut** (and excludes data-grid anyway),
   not the end-state. The finding therefore *strengthens* B on merit: a per-block entry point = a precise
   per-block published surface, which the shared family barrel cannot give.

## Anti-drift requirement (raised in discussion 2026-06-20 — part of what B means)

A curated barrel is a new artifact, so it must not become its own drift surface. B is drift-proof in
**both** directions only under one rule:

- **Named re-exports only — never `export *`.** `export *` would silently republish every internal symbol
  a refactor adds; the published surface must be an explicit curated list, or "reachable through the public
  entry point" means nothing. This is the non-negotiable authoring rule for the 5 barrels.
- **Barrel → impl: guarded by the compiler (free).** A named `export { X } from './leaf'` is a TS error
  (TS2305) if the leaf stops exporting `X` → FUI's typecheck fails. The barrel can never over-claim vs impl
  — strictly stronger than A, which has no entry point asserting the surface.
- **Contract → barrel: guarded by this gate.** Re-point + extend the §8e `barrelBlocks` filter so the 5
  renderers ride the same `getExportsOfModule` TS-program path, then flip `EXPORT_SHAPE_ENFORCED` →
  contract↔barrel drift becomes a **hard error**, permanently. (Subset semantics kept uniform — extras
  allowed, same as the 7 barrel blocks; do **not** fork to exact-match, which would re-split the resolver.)

Net: today renderers are un-coverable (zero drift detection); B closes both directions with a hard gate.

## Context

**Per-fork classification (the 7-question pass).** This element is the **conformance-gate / tooling layer**
(`we:scripts/check-standards.mjs` + `we:scripts/check-standards-rules.mjs`), not a Block / Intent / Protocol / Capability — it is the *verification
machinery for* the block contract. So the intent-dimension, DI-injectability, and seam questions are
**N/A**: no WE-published artifact and no consumer-facing knob changes either way (the
`EXPORT_SHAPE_ENFORCED` invariant is identical; only *how* a renderer's actual surface is resolved changes).
The governing principles are the **published-surface definition** (entry point = public API) and **one
uniform resolver semantic** — both selecting B.

**Graduation (on ratifying B).** Spins out, in composition order: 5 `index` barrels under
`fui:blocks/renderers/<id>/` (`locus: frontierui`) → 5 `implementedBy` re-points in `we:src/_data/blocks/` → extend the §8e
`barrelBlocks` filter ([we:scripts/check-standards.mjs:824](../scripts/check-standards.mjs#L824)) to include
them + regenerate CEM (`gen:cem`).

**Relationship to #927 / the flip.** Does **not** block #927's arm — that shipped warn-first scoped to the 7
barrel blocks and logs renderers un-coverable. This decision gates *extending* the arm to renderers and the
eventual `EXPORT_SHAPE_ENFORCED` flip
([we:scripts/check-standards-rules.mjs:1425](../scripts/check-standards-rules.mjs#L1425)), which also waits
on **#1165** (resolve the 3 barrel-block drifts). Slice of epic #904.
