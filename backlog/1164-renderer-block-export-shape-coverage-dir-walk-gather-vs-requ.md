---
type: decision
workItem: story
size: 3
parent: "904"
status: open
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
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
