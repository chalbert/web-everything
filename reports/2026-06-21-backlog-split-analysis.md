# Backlog split analysis — 2026-06-21 (`/slice 1304`, focused — revises the sweep below)

Focused `/slice 1304` — **#1304 declarative scoped registration + global patching (core)** (`story`,
`size: 13` frontmatter but body-recorded **8** post the 2026-06-20 carve of #1350 + #1354). The **bare-sweep
section further down this same report ruled #1304 could-not-split** on the grounds that "a port-files-only
slice leaves a red MOMENT-2 test = no demoable state (rubric 5)." **This focused pass overturns that** — the
sweep only weighed the coarse "port the files" seam; reading the actual modules surfaces a finer seam that
keeps every intermediate state green. **Confidence ~70%** (residual below).

## Investigation (real tree, 2026-06-21)

FUI is missing both declarative files and stubs the patching:
- `fui:plugs/webregistries/declarativeRegistry.ts` — **absent** (WE: 306 lines).
- `fui:plugs/webregistries/ScopedRegistryAttribute.ts` — **absent** (WE: 57 lines).
- `fui:plugs/webregistries/index.ts:23-65` — `applyPatches`/`removePatches`/`isPatched` are **TODO
  `console.warn` stubs**; WE's [we:plugs/webregistries/index.ts:71-129](../plugs/webregistries/index.ts#L71)
  is fully written.

**Dependency edges (the seam map):**
- `we:declarativeRegistry.ts` imports **only** `./CustomElementRegistry`
  ([we:plugs/webregistries/declarativeRegistry.ts:36](../plugs/webregistries/declarativeRegistry.ts#L36)).
  FUI's CER was reconciled by the **resolved #1354** (#1101 `whenDefined` + #1102 dup-guard, `downgrade`
  preserved) — its public API (`{extends}` ctor, `define`/`has`/`get`/`upgrade`/`whenDefined`) **matches
  what declarativeRegistry needs**. So this module ports onto a ready base — **not** blocked by #1350/#1354.
- `we:ScopedRegistryAttribute.ts` imports `../webbehaviors/CustomAttribute` **and** `./declarativeRegistry`
  ([:17-23](../plugs/webregistries/ScopedRegistryAttribute.ts#L17)). FUI's `CustomAttribute` **DIFFERS** from
  WE's — that divergence is the root of the `bound=false` MOMENT-2 failure (the `behavior.attach()` →
  `attachedCallback` → `#bind` path). Bounded FUI-side debugging, **isolated to this file pair**; it does
  **not** require touching `we:declarativeRegistry.ts`.
- Global patching imports `applyScopedRegistryToHost` + `SCOPED_REGISTRY_KEY` **from declarativeRegistry**
  ([we:plugs/webregistries/index.ts:37](../plugs/webregistries/index.ts#L37)) — **not** from
  ScopedRegistryAttribute. So patching depends on the declarative *core* only.
- The test [we:.../declarativeRegistry.test.ts](../plugs/webregistries/__tests__/unit/declarativeRegistry.test.ts)
  **already separates** the `ScopedRegistryAttribute (MOMENT-2 binding behavior)` describe block (`:172-201`)
  from the parse/compose/define/resolve/map-through blocks (`:38-170`) — a clean test-file cut.

This dissolves the sweep's rubric-5 objection: draw the seam **between `declarativeRegistry` and
`ScopedRegistryAttribute`** (not "port all files"), and the `bound=false` test lives only in the slice that
also ships its fix — no slice ever lands a red test.

## Could split — #1304 → storied epic, 3 slices

DAG: **D1 → {D2, P}** (D2 ⟂ P, both depend on D1 only).

| Slice | Scope | Files | workItem | size | blockedBy |
|---|---|---|---|---|---|
| **D1** — declarative registry core | port `we:declarativeRegistry.ts` (parse / IDREF-`extends` compose / scoped-define + lazy queue / `resolveScopedRegistry` / `applyScopedRegistryToHost` / map-through) + its non-attribute tests; add index exports | `fui:plugs/webregistries/declarativeRegistry.ts` (new), `fui:plugs/webregistries/index.ts`, `fui:plugs/webregistries/__tests__/unit/declarativeRegistry.test.ts` (new, minus the attribute block) | story | 3 | — |
| **D2** — MOMENT-2 binding behavior + FUI fix | port `we:ScopedRegistryAttribute.ts` + **fix the FUI `CustomAttribute` integration so `bound=true`** + restore the `ScopedRegistryAttribute` describe block | `fui:plugs/webregistries/ScopedRegistryAttribute.ts` (new), `fui:plugs/webbehaviors/CustomAttribute.ts` (likely), `fui:plugs/webregistries/index.ts`, the test's attribute block | story | 3 | **D1** |
| **P** — plugged-mode global patching | port `applyPatches`/`removePatches`/`isPatched` + `attachShadow` scoped-init (pure copy of WE's already-written code) + `we:globalPatching.test.ts` | `fui:plugs/webregistries/index.ts`, `fui:plugs/webregistries/__tests__/unit/globalPatching.test.ts` (new) | task | — | **D1** |

**Why this is a real split, not fragmentation:** D1 is a mechanical port of resolved-design code onto a
now-compatible CER (green on its own). P is a ~60-line copy of code WE already shipped (green). D2 quarantines
the *one* uncertain piece — the FUI `CustomAttribute` binding debug — so its risk can't stall the two
mechanical ports. The card's "internally entangled → one focused story" rests on the index→declarativeRegistry
import, which is a **clean one-way edge** (modelled by `blockedBy`), not a true entanglement.

**Rubric (all five hold):** (1) the genuine fork was already carved to #1350; the remainder is volume +
bounded debugging, no open decision ✓ · (2) 3 nameable slices, each homed in `fui:plugs/webregistries/` ✓ ·
(3) D1·3, D2·3, P·task ✓ · (4) clean DAG D1→{D2,P}, D2⟂P independent after D1 ✓ · (5) **green at every step** —
after D1: declarative parse/define works, patching still warn-stubs, attribute not yet ported (no red test);
after D2: MOMENT-2 binds; after P: plugged mode works ✓.

**Residual (the ~30%):** D1 could drift toward 5 if FUI import-path / CER edge cases surface during the port;
and the D2 binding fix *might* need a small `declarativeRegistry` touch (e.g. `getActiveRegistryResult`
module-state timing) — if so D2 also-edits D1's file, still a clean `blockedBy` chain, no cycle.

**Conservative alternative** (if you'd rather not 3-way it): peel only **P** (pure copy, batchable task)
and keep **D1+D2 as the size-5 declarative core** — but that core stays non-batchable, so it manufactures
only one batchable slice and does *not* quarantine the binding risk. I don't recommend it.

## Net flow on approval

`#1304` story → **storied epic** (drop `size`, digest → umbrella; it already has `parent: 1250`, so per the
already-parented edge case it could instead stay a re-sized `story` for D1 with D2/P as siblings under #1250
— I recommend the epic form for a clean umbrella, parented to #1250). **+3 slices** (D1, D2, P). Children
batchable → `/batch`. This **supersedes the #1304 row in the sweep section below** (no longer a data-only fix).

---

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

---

# Backlog split analysis — 2026-06-21 (bare `/split` sweep)

Whole-candidate sweep. **Authoritative frontmatter scan of `backlog/*.md` (open only):**

- **Oversized stories** (`kind: story`, `size` > 8, no `unsplittableReason`): **#1236**, **#1304**.
  *(#1327 — the focused run above — was a candidate at sweep time but is handled by that run; #1351 has
  resolved children, no longer unsliced.)*
- **Unsliced epics** (`kind: epic`, no child names them `parent`, no `childlessReason`, not a program):
  **#555**.

**Result of the sweep: zero further items split.** Two oversized stories are *stale-frontmatter false
flags* — already split on 2026-06-20 with the post-split size recorded in the body but never written back
to `size`; the epic is foundational-blocked behind a parked dependency.

## Could split — none (from the swept set)

## Could not split

| #NNN | Title | Failing condition | Unblocking action |
|---|---|---|---|
| **#1236** | Render the WE pitch deck on FUI deck components + plateau hosting | **Already split** (`/split 1236`, `we:reports/2026-06-20-backlog-split-analysis.md` §"focused: #1236"). Carved siblings **#1359** (developer/technical deck) + **#1360** (design-system/enterprise deck), both `blockedBy: 1236`; residual #1236 re-sized **13 → 5** = foundational plateau deck shell (atomic, one focused multi-repo integration). Body records the re-size; `size: 13` frontmatter is **stale** → re-flags. | **Data fix, not a split:** correct `size: 13` → `5`. No further seam (shell is the atomic core; B/C carved). |
| **#1304** | Reconcile fui:plugs/webregistries UP to WE — declarative scoped registration + global patching (core) | **Already split** (`/split 1304`, same 2026-06-20 report §"focused: #1304"). Carved decision **#1350** (Plug-lifecycle `downgrade` fork) + clean-improvements sibling **#1354** (#1101/#1102); residual #1304 re-sized **13 → 8**. Prior run **already ruled split-further could-not-split** (rubric (3)/(5): the `bound=false` MOMENT-2 binding fix is investigation-gated; a "port files only" slice leaves a red test = no demoable state). `size: 13` frontmatter is **stale**. | **Data fix, not a split:** correct `size: 13` → `8`. Re-`/split` only after the port lands + binding fix is diagnosed (if large + separable). |
| **#555** | Collaborative deployed-patch preview — hosted SaaS surface for #410 overlays | **Foundational / condition (1)** — `blockedBy: #554` (`status: parked` by intent behind the defer-live-serve strategy). The epic's own body says the six collaboration features "stay uncarved until #554 un-parks." Slicing now would author detail-less shells against a hosting surface that doesn't exist (work-investigation: surface absent). Sequencing fork is **not buried** (body settles it — shareable-preview-link first). | **Un-park #554** (when live-serve is on the roadmap), then carve the six features as `parent: 555` stories. No `type:decision` card needed (no buried fork); no `childlessReason` (blocked, not childless-by-nature). |

## Recommended mutations (gated on go)

Both are one-line frontmatter corrections — **no scaffolding, no epic conversion, no `/split` mutation:**

1. `#1236`: `size: 13` → `5` (match body-recorded re-size; siblings #1359/#1360 carry the rest).
2. `#1304`: `size: 13` → `8` (match body-recorded re-size; #1350/#1354 carry the carve-outs).

These are data-integrity corrections (the honest values live in the bodies), not a "dishonest shrink to
dodge the scan" — they stop the board re-flagging both items every sweep. Once `size ≤ 8` they fall out of
the split band, so neither needs an `unsplittableReason`. #555 needs nothing now (re-evaluate when #554
un-parks).
