# Backlog split analysis — 2026-06-21 (`/slice 1351`)

Focused slice of **#1351 — Scaffold the webgraph standard** (unsliced `epic`, shape settled by the
ratified #1352, codified `we:docs/agent/platform-decisions.md#viz-family-shape`). Since it is already an
epic, rubric (1) "size is volume not a fork" is settled at the parent level; each proposed slice is still
verified against the real tree and the remaining rubric conditions.

## Investigation (real tree, not body framing)

The sibling **webcharts** standard is the direct template. Its scaffold epic **#570** was sliced into four
`kind: task` children with a clean DAG:

| webcharts slice | file | `blockedBy` |
|---|---|---|
| #571 A — project node + skeleton page | `we:src/_data/projects/webcharts.json` + `we:src/_includes/project-webcharts.njk` | — (root) |
| #572 B — Vega-Lite L1 profile schema | `we:src/_data/semantics.json` | #571 |
| #573 C — `CustomChartRenderer` protocol | `we:src/_data/protocols/custom-chart-renderer.json` + `we:src/_data/plugs/customchartrenderer*.json` | #571 |
| #574 D — conformance suite + a11y axis | `we:src/cases/webcharts/01..04*.html` (3 axes) | #572, #573 |

(The TypeScript `we:contract.ts` authoring was **not** in #570's A–D; webcharts carved it later as **#1334**,
and a conformance demo as **#1293**. webgraph mirrors that deferral — see *Out of scope* below.)

webgraph differs from webcharts in exactly two ways the #1352 ruling fixed:
- **Two protocol seams** (`CustomGraphLayout` ⟂ `CustomGraphRenderer`) instead of webcharts' single
  `CustomChartRenderer` — they share a `PositionedGraph` interface (layout output = renderer input).
- **A graph-a11y research topic** (tier-2 grounding) — webcharts' a11y pattern was settled; graph a11y has
  no settled platform pattern, so #1352 fork 3 mandates a `/research/` topic before tier-2 is specced.

Consumer data shape to honour: `plateau:src/platform-manager/types.ts` `GraphNode {id,kind,label}` /
`GraphEdge {from,to,kind,confidence,seam}`; default layout = the pure columnar DAG in
`plateau:src/platform-manager/platform-map.ts` (`layoutGraph()`).

## Could split — #1351 → 5 task-slices

All `kind: task` (registry/data-layer authoring against proven 11ty infra — no `size` needed, mirrors
#570's A–D). DAG: **A → {B, C} → D**, with **E independent**.

| slice | scope | files (all `we:`-citable from the webcharts template) | `workItem` | `blockedBy` |
|---|---|---|---|---|
| **A** — project node + skeleton spec page | project tile + spec page renders at `/projects/webgraph/` | `we:src/_data/projects/webgraph.json`, `we:src/_includes/project-webgraph.njk`, `we:assets/icons/webgraph.svg` | task | — |
| **B** — `GraphSpec` profile + terms | node/edge semantic profile, presentation-free, grounded on plateau `GraphNode`/`GraphEdge`; new terms `graph-spec`, `node-link diagram`, `layout strategy`, `adjacency description` | `we:src/_data/semantics.json` | task | A |
| **C** — two-seam swap protocol | `CustomGraphLayout` (GraphSpec → `PositionedGraph`, incl. optional edge waypoints) ⟂ `CustomGraphRenderer` (`PositionedGraph` + theme → output), co-authored around the shared `PositionedGraph` interface; native-first SVG + deterministic layered-DAG default | `we:src/_data/protocols/custom-graph-layout.json`, `we:src/_data/protocols/custom-graph-renderer.json`, `we:src/_data/plugs/customgraphlayout*.json`, `we:src/_data/plugs/customgraphrenderer*.json` | task | A |
| **D** — conformance cases + benchmark refs | `we:src/cases/webgraph/` scoring 3 axes (semantic fidelity · theme · a11y, tier-1 adjacency description-table floor); add graph libs (D3-force, ELK/dagre, Cytoscape, Mermaid, reaflow) to `we:src/_data/references.json` | `we:src/cases/webgraph/0N-*.html`, `we:src/_data/references.json` | task | B, C |
| **E** — graph-a11y research topic | `/research/` topic grounding the tier-2 a11y model (treegrid / ARIA graph-role traversal); independent of the code path (tier-1 floor is settled) | `we:src/_data/research/*.md` (or repo research-topic home) | task | — |

**Why C is one slice, not two:** the two seams are independently swappable at *runtime* but co-defined at
*authoring* time — the renderer protocol references the `PositionedGraph` shape the layout protocol emits.
Splitting C1-layout / C2-renderer would let one land referencing an interface the other hasn't defined yet
(invalid intermediate state, violates rubric 5) and bury their co-design coupling. Kept as one task-sized
registry-authoring act, mirroring webcharts #573.

**Rubric (each slice):** (2) ≥2 nameable slices, each a real home cited from the template ✓ · (3) each ≤3 /
`task` ✓ · (4) clean DAG, real independence (E parallel; B⟂C parallel after A) ✓ · (5) each leaves a valid
demoable state — A renders the project tile, B the profile+terms, C the protocol pages at `/protocols/`, D
the conformance cases, E the research page ✓. No slice buries a fork (#1352 settled all four).

## Could not split — none

#1351 splits cleanly into 5. No rubric condition fails for any slice.

## Out of scope (deferred follow-ups, not "could not split")

Mirroring the webcharts trajectory, carved *after* this data-layer scaffold lands — not part of this split:
- **`we:contract.ts` authoring** (`@webeverything` published `GraphSpec` / `CustomGraphLayout` /
  `CustomGraphRenderer` TS types) — webcharts did this as a separate #1334; carve the webgraph twin after A–D.
- **Per-engine adapters** (force / ELK / Cytoscape behind `CustomGraphLayout`) — deferred and carved
  per-engine after the contract lands, per the webcharts precedent and #1351's own *Downstream* note.
- **#1289 FUI build slices** — the foundational contract this epic lands unblocks #1289
  (`unsplittableReason: foundational`); re-run `/split 1289` once A–D ship.

---

# Backlog split analysis — 2026-06-21 (`/slice 1327`)

Focused `/slice 1327` — **#1327 semantics glossary comprehensiveness** (`story`, `size: 13`), just
unblocked by the #1343 ratification (glossary = concept categories required wholesale + `isConcept`
opt-in for contested-name blocks/plugs). Its body already names three streams; this pass verifies
the seams against the real tree and re-estimates.

## Investigation (real tree, 2026-06-21)

- **Gate home** — `we:scripts/check-standards.mjs:248` (§5 semantics-hygiene). The gate already
  loads every registry as an array alongside `semantics`: `intents` / `protocols` / `capabilities`
  / `blocks` / `plugs` (`we:scripts/check-standards.mjs:114`–`123`). A coverage rule is a pure
  in-file addition beside §5 — build a normalized term-set, iterate the in-scope dirs, `warn` on a
  miss; additionally require a term for any `blocks`/`plugs` entry flagged `isConcept: true`.
- **Term files** — `we:src/_data/semantics/<slug>.json`, each `{ term, definition, usage }`, no
  provenance field. Backfill = authoring new term files; definitions are editorial prose (no
  transform derives them — settled in #1343 *Supported by default*).
- **Gap (the #1327 audit, re-confirmed)** — missing a glossary term: intents **46**, protocols
  **29**, capabilities **0** (already covered). In-scope wholesale backfill ≈ **75**.
- **Seam** — two axes that don't interact: *editorial* (`we:src/_data/semantics/`) vs *code*
  (`we:scripts/check-standards.mjs`), and within editorial, *by source registry* (intents vs
  protocols) — which mirrors the gate's own per-registry iteration, so it's a real seam, not an
  arbitrary volume cut. Capabilities need no backfill slice (0-gap); they're simply in the gate's
  required set.

## Could split — #1327 → storied epic, 4 children

| Slice | Title | workItem | size | Surface | blockedBy |
| --- | --- | --- | --- | --- | --- |
| **A1** | Backfill intent glossary terms (46) | story | 5 | `we:src/_data/semantics/` (new) | — |
| **A2** | Backfill protocol glossary terms (29) | story | 3 | `we:src/_data/semantics/` (new) | — |
| **B** | Scoped coverage gate + `isConcept` honoring | task | — | `we:scripts/check-standards.mjs` §5 | — |
| **C** | *(existing #1368)* block/plug curation — flag `isConcept` names | story | 5 | `we:src/_data/{blocks,plugs,semantics}/` | **B** |

**DAG:** A1, A2, B mutually independent (parallel — different files / source registries). C (#1368)
is `blockedBy: B` — flagging a block `isConcept` is only enforced once the gate honors the flag, so
flagging before B is drift-prone busywork. #1368 is re-parented under #1327 (it is the (1c) slice)
and its `blockedBy` re-pointed from the epic to slice B.

**Valid demoable state at every step:** the coverage rule lands at **warn** level (matching the
gate's existing coverage warnings), so B can land first and simply surfaces the ~75 gap as warnings
(0 errors); A1/A2 then clear them incrementally per registry. No ordering is *required* — order is
prioritization.

**Rubric (all five hold):** (1) scope fork already resolved (#1343), remainder is bounded backfill +
a mechanical gate ✓ · (2) 4 nameable slices, each a distinct `file:line`-cited home ✓ · (3) B a task,
A2 a size-3 story, A1/C size-5 stories (the irreducible editorial bulk — splitting 46/53 authored
definitions finer is an arbitrary cut at term N, not a seam) ✓ · (4) clean DAG, A1/A2/B parallel, C
gated on B, no cycle ✓ · (5) warn-level gate + partial-coverage glossary both valid (0 errors
throughout) ✓.

## Could not split — none

No row fails the rubric; nothing is design-gated (the only fork, #1343, is resolved). Capabilities
need no slice (0-gap). No `type:decision` card to file.

## Net flow on approval

`#1327` story·13 → storied epic (size dropped, digest → umbrella). +2 new slices (A1, A2) + 1 new
task (B); #1368 re-parented + re-pointed (no new item). Children become batchable → `/batch`.
