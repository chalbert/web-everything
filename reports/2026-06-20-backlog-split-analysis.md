# Backlog split analysis — 2026-06-20 (focused: #1179)

`/slice 1179` — single-item run. Candidate: **#1179 — Temporal / advanceable-media sequence
intent family (deck · video · carousel)** (`workItem: epic`, `size: 5`, `relatedProject: webintents`,
no children → unsliced-epic candidate kind **b**).

## Verdict: **could not split** — overtaken by the #1173 carve; residual is one atomic intent

#1179's body instructs: *"slice into the member intents (advance, autoplay, up-next, interstitial,
present-surface) **once the deck carve (#1173) confirms** the concrete shape each consumer needs."*
That gate has **already fired**, and it dissolved the split rather than enabling it:

- **#1173 is resolved** (graduated to `we:reports/2026-06-19-deck-slide-standards.md`).
- **#1175 ratified B (fully distributed)** — no `webdecks` umbrella; the 21 deck contracts were carved
  as **standalone** slices #1180–1200, each homed by `relatedProject`, none parented.
- **4 of the 5 "member intents" #1179 names already exist as those standalone slices**, and they
  reference #1179 as the kernel they *compose* (they are its consumers, not its children):

  | #1179 member | already-carved standalone slice | home | size |
  |---|---|---|---|
  | autoplay / timed-advance | [#1188](../backlog/1188-autoplay-timed-advance-extension-carousel-wake-lock.md) | webintents | 2 |
  | "up next" preview | [#1199](../backlog/1199-up-next-what-to-view-next-preview-shared.md) | webintents | 2 |
  | interstitial / overlay | [#1200](../backlog/1200-interstitial-overlay-insertion-ad-breaks-shared.md) | webintents | 3 |
  | present-surface (fullscreen) | [#1198](../backlog/1198-fullscreen-presentation-mode-semantic-intent.md) | webportals | 2 |
  | *(deck-layer composers)* | [#1181](../backlog/1181-fragment-incremental-reveal-intent-step-reveal-within-a-slide.md) fragment · [#1187](../backlog/1187-overview-grid-zoom-out-intent-slide-sorter.md) overview | webintents | 3 / — |

  [#1181](../backlog/1181-fragment-incremental-reveal-intent-step-reveal-within-a-slide.md#L15)
  literally states *"Composes the advanceable-sequence family (#1179)."* — so these are **downstream
  consumers**, not slice candidates hidden inside #1179.

What remains **uniquely** to #1179 after the carve is a single deliverable: **mint the
`advanceable-sequence` kernel intent in webintents** — the `current/next/prev` + sequence-position
vocabulary and family meta-schema that [we:carousel](../src/_data/blocks/carousel.json) already owns
informally (its `composesIntents: [motion, live-region-status, navigation]` has no sequence kernel)
and that deck/video/carousel compose. There is **no existing `advanceable-sequence` / `sequence`
intent** under [src/_data/intents/](../src/_data/intents/) (the `temporal` intent there is date/time
selection — unrelated). That kernel is one atomic intent-authoring story (~size 3–5), not ≥2 slices.

### Could-not-split table

| # | Title | Failed rubric condition | Unblocking / cleanup action |
|---|---|---|---|
| **#1179** | Temporal / advanceable-media sequence intent family | **(2) ≥2 nameable slices, each a real home** — the 5 named members are already standalone slices (#1188/#1199/#1200/#1198 + composers #1181/#1187); the unique residual is a single atomic kernel intent. Also fails the *premise*: at `size: 5` it was never oversized (≤8 = batchable) — it entered the set only as an `epic`-with-no-children, a now-stale shape. | **Re-scope #1179 `epic` → `story` (size ~5)**: it is the single "mint the `advanceable-sequence` kernel intent" story. Replace the stale *"slice into the member intents once #1173 confirms"* body (the carve happened; members are standalone) with cross-refs to the already-carved composers (#1188/#1199/#1200/#1198/#1181/#1187). Then it flows straight into `/batch` as one story. |

### Why not the alternatives

- **Re-parent #1188/#1199/#1200/#1198 under #1179 to make it a real family epic** — would **reverse
  ratified #1175 (B, fully distributed, no umbrella, standalone slices homed by `relatedProject`)`.
  Decisions are reversible, but slicing is not the place to do it, and there's no case here: the
  distributed homes are working and the consumers already reference #1179 by prose. Not recommended.
- **Slice the kernel itself into "mint intent JSON" + "rewire carousel to compose it"** — a thin
  2-step linear chain (size 2 + 2) out of a size-5 story: exactly the *needless* split the conservative
  instinct refuses (fragments one coherent deliverable, adds review overhead, zero independence gain).
  Keep it whole.

## Could split

*(none this run)*

## Recommended action (gated on approval — not a split)

No on-disk **split**. The honest move is a one-item **re-scope**: convert #1179 `epic → story` (size 5),
de-stale its body to reference the already-standalone composers. This is a backlog edit, not a slice,
so it's outside `/slice`'s auto-mutation mandate — flagged here, applied only on a "go".

---

# Focused: #1245 — reference-runtime blocks duplicated/drifting between WE and FUI

`/slice 1245` — single-item run. Candidate: **#1245** (`type: issue`, `workItem: epic`, `size: 8`,
`relatedProject: webblocks`, no children → unsliced-epic candidate kind **b**).

## Verdict: **could not split** — the epic buries a live canonical-home decision (rubric condition 1)

| # | Title | Kind | Verdict |
|---|---|---|---|
| #1245 | Reference-runtime blocks (router, navigation, …) are duplicated and drifting between WE and FUI | unsliced `epic` (`size 8`, no children) | **Could NOT split** — embedded canonical-home decision gates all build work |

### Investigation (the real tree, 2026-06-20)

- **The duplication is real.** `we:blocks/` holds full runtime `.ts` for the STAY subset
  (`router/`, `navigation/`, `parsers/`, `text-nodes/`, `for-each/`, `transient/`, `attributes/`,
  `draft-persistence/`, plus `view/`, `tabs/`, `wizard/`, `workflow-engine/`, `resource-loader/`,
  `data-transfer/`, `renderers/*`, `stores/`), and `fui:blocks/` holds a parallel copy of each.
- **The contract already says FUI-canonical.** Every STAY block with a spec declares
  `implementedBy: @frontierui/blocks/<id>/…`, `status: active` (the per-block spec files
  router/view/for-each/draft-persistence/tabs/wizard/workflow-engine/resource-loader under
  `we:src/_data/blocks/`). Per **#641**
  (resolved 2026-06-15, codified `we:docs/agent/platform-decisions.md#constellation-placement`):
  *WE blocks are pure protocols; impl lives in FUI; WE holds NO block-impl copy.*
- **But #697 (resolved 2026-06-17, AFTER #641) deliberately kept a reference-runtime subset in WE**
  ("blocks whose demos exercise a WE *standard*"). The later ruling carved an exception to the earlier
  one, and the filesystem reflects both at once: the contract says FUI-canonical while a full WE
  runtime copy persists. **That contradiction is the open decision the epic buries.**
- **Five dirs have no spec at all:** `navigation`, `parsers`, `text-nodes`, `transient`, `attributes`
  — no entry under `we:src/_data/blocks/`, so they aren't even declared WE protocols and the **#659**
  drift gate (`validateBlockImplConformance`, `we:scripts/check-standards-rules.mjs:1326`) never sees
  them. Pure undeclared duplicates.
- **The existing drift gate covers only the MOVED families.** #659 checks an `implementedBy` pointer
  *resolves* in FUI; it does **not** flag a WE `blocks/<id>/` runtime copy *existing* for an
  `implementedBy`-declared block, and can't see the five unspec'd dirs. So the hazard #1245 names is
  genuinely untracked.

### Could-not-split table

| # | Failed condition | Why | Unblocking action |
|---|---|---|---|
| #1245 | **(1) Volume, not uncertainty** — the body holds a live `type: decision` fork ("canonical home", §"Open question") that sets the *direction* for every dedup and the drift-gate shape; slicing now just scatters the same fork across children. (Also (5): the gate's form — byte-diff vs contract-seam vs no-WE-copy — is undefined until the seam is chosen.) | #641 (FUI-canonical, no WE copy) vs #697 (kept reference-runtime STAY subset in WE) are in unreconciled tension; the filesystem reflects both. A blind file-copy is wrong either way (copies carry deliberate FUI adaptations: import style, tag defaults, the #365/#423 deltas). | **Resolve the canonical-home decision first.** Carve it out of the epic body into its own `type: decision` card, de-bury the parent (inline fork → pointer), set epic `blockedBy` the card. Once ruled, the slices below become batchable. |

### Slices that become carvable once the decision resolves (proposed, not filed)

1. **`router` dedup** (`story`, ~3) — first; has live evidence + load-bearing for every consuming app.
   Reconcile per the ruling (delete WE copy + wire seam, *or* formalize the WE reference-runtime home),
   regression-guard the #365/#423 fixes.
2. **Per-family dedup** (`story`/`task`, ~2 each) — `navigation`, `parsers`, `text-nodes`, `for-each`,
   `transient`, `attributes`, `draft-persistence`, then the remaining #697 STAY families
   (`view`, `tabs`, `wizard`, `workflow-engine`, `resource-loader`, `data-transfer`, `renderers/*`,
   `stores/simple`). Each blocked by slice 1's seam pattern.
3. **Declare the five unspec'd dirs** (`task`, ~2) — add `we:src/_data/blocks/{navigation,parsers,
   text-nodes,transient,attributes}.json` (or fold into siblings) so #659 can see them.
4. **Extend the drift gate** (`story`, ~3) — extend `validateBlockImplConformance` to *also* fail when a
   WE `blocks/<id>/` runtime dir exists for an `implementedBy`-declared block (no WE impl copy),
   mirroring the plugs byte-diff guard. Blocked by the dedup slices (enforced once the tree is clean).

DAG: `decision → slice 1 (router) → slices 2/3 (parallel per family) → slice 4 (gate, enforced last)`.

## Recommended action (gated on approval — not a split)

No on-disk split. The honest move per the could-not-split handling: **file the buried fork as its own
`type: decision` card** (next free `#1246`), register it Tier-B, and **de-bury #1245** (inline
"Open question — canonical home" § → a pointer; epic `blockedBy: ["1246"]`, `childlessReason: undecided`,
`size 8` kept — still unsliced). Gated on one "go".

## RE-RUN — 2026-06-20, post-#1246 (`/slice 1245` again)

[#1246](/backlog/1246-canonical-home-for-the-reference-runtime-stay-subset-blocks-/) **resolved**
the buried fork: **WE holds zero block runtime — delete all WE copies, FUI is sole home** (codified
`we:docs/agent/platform-decisions.md#constellation-placement` + `#we-fui-embed-boundary`). Condition (1)
is now settled, so I re-investigated the **real runtime import graph** (not doc-text references) to find
which deletes are deliverable now vs. gated on FUI-side work.

### Investigation — the true runtime-consumer graph (code imports only, not `.njk`/`.json` doc refs)

| Family | WE runtime importers | WE unit test? | FUI impl? | Deliverable now? |
|---|---|---|---|---|
| **draft-persistence** | **0** | no | yes (`fui:blocks/draft-persistence`, 4 ts) | **✅ yes** |
| **data-transfer** | **0** | no | yes (`fui:blocks/data-transfer`, 3 ts) | **✅ yes** |
| router, navigation, parsers, text-nodes, for-each, transient, attributes | only `we:plugs/bootstrap.ts` (7 families, 1 importer) | yes (most) | yes | ❌ bootstrap-gated |
| view + tabs | `we:demos/view-tabs-demo.html` | yes | yes; `fui:demos/view-tabs-demo.html` exists | ❌ two unknowns |
| wizard + workflow-engine | `we:demos/wizard-flow-demo.ts` | yes | yes | ❌ no FUI-hosted demo |
| resource-loader | `we:demos/loader-background-handoff-demo.ts` | yes | yes | ❌ no FUI-hosted demo |
| stores | `we:demos/declarative-spa{,-router}.html` | yes | yes | ❌ no FUI-hosted demo |
| renderers | **11** demos (`data-table`, `pagination`, `reorderable-list`, `maas-consumer`, jsx-adapter, …) | yes | yes | ❌ no FUI-hosted demos |

Key facts that set the gates:
- **The 16 "consumers" the body counts are mostly doc-text refs.** Filtering to real code imports, every
  STAY family has **0–1** runtime importer except `renderers` (11). The duplication is real, but the
  *relocation surface* is small and concentrated in `we:plugs/bootstrap.ts` + a handful of demos.
- **`we:plugs/bootstrap.ts` can NOT be repointed at `@frontierui/*`.** The 7 families
  (router/navigation/parsers/text-nodes/for-each/transient/attributes) are imported only by
  `we:plugs/bootstrap.ts` (`registerRouter`, `registerNavigation`, … `we:plugs/bootstrap.ts:44-55`).
  The obvious "repoint bootstrap's import to FUI, then delete the dir" shortcut is **forbidden by
  `#we-fui-embed-boundary`** (WE never imports FUI block runtime — [[project_docs_rendering_boundary_we_iframes_fui]]).
  So these 7 can only be deleted after their **~12 bootstrap-consuming demos are re-hosted FUI-side**
  and `we:plugs/bootstrap.ts` itself leaves (the #606 move). That re-host is **FUI build work** — most equivalents
  don't exist FUI-side yet (`wizard-flow`, `loader-background-handoff`, `data-table`, `pagination`,
  `reorderable`, `component-adapter`, `jsx-adapter` → **none** in `fui:demos/`).
- **The block-unit-test → conformance-vector path is unbuilt.** `we:conformance-vectors/` holds only
  non-block vectors (`validator-resolution`, `session-replay-envelope`, `slide-transition`, `webdocs`);
  there is **no precedent** for converting a `we:blocks/__tests__/unit/<family>` suite into FUI-run
  vectors. Every test-bearing family's delete inherits this unbuilt conversion → not agent-ready until a
  pilot establishes the pattern.
- **draft-persistence & data-transfer are uniquely clean:** 0 runtime importers, **0 unit tests**, only a
  single doc-ref `.njk`/`.json` each, FUI impl confirmed present. Deleting them breaks nothing and needs
  no FUI-hosting or vector-conversion gate.

### Could split — deliverable now (3 slices, all independent / batchable)

| Slice | kind·size | Scope | blockedBy |
|---|---|---|---|
| **A — delete `we:blocks/draft-persistence/`** | story · 2 | Remove the WE runtime copy (FUI canonical, `implementedBy` already declared); repoint its 1 doc-ref `.njk`/`.json` to `fui:`. No consumer, no test → no break. | — |
| **B — delete `we:blocks/data-transfer/`** | story · 2 | Same, for `data-transfer`. | — |
| **C — pilot block-test → conformance-vector conversion** | story · 3 | Author WE-owned vectors for one small tested family (**`text-nodes`**, 3 ts) from `we:blocks/__tests__/unit/text-nodes`, register under `we:conformance-vectors/` per #817/#899. Establishes the pattern items 2–4 of the plan reuse. **Does not delete runtime** (that stays bootstrap-gated) → leaves a valid state. | — |

**DAG:** A, B, C are **mutually independent** (disjoint dirs, no shared edge) → 3-wide batch (≥2
independent ✓✓). Each leaves a valid, demoable state. None is gated on FUI-side work.

### Could not split here (deferred — gated on FUI build, not a decision)

| Scope | Failed condition | Unblocking action (foundational, FUI-side) |
|---|---|---|
| **7 bootstrap-gated families** (router, navigation, parsers, text-nodes·runtime, for-each, transient, attributes) | (5) deleting any breaks `we:plugs/bootstrap.ts` → breaks ~12 WE demos; (3) embed boundary forbids the WE→FUI repoint shortcut | **FUI hosts the ~12 bootstrap-consuming demos, then `we:plugs/bootstrap.ts` relocates to FUI (#606).** Then delete the 7 in one follow-up slice. |
| **wizard + workflow-engine, resource-loader, stores, renderers (×11)** | (5) deleting breaks the consuming demo; no FUI-hosted equivalent exists | **FUI builds each hosted demo**, WE swaps the local page → `#701 fuiDemo` iframe (or mode-C bundle), then delete the family. One slice per demo as FUI ships it. |
| **view + tabs** | (3)/(5) two unknowns: is `fui:demos/view-tabs-demo.html` actually iframe-embeddable, and the vector path (slice C) | Closest-ready: re-evaluate after **C** lands + confirming the FUI demo self-bootstraps. |

**Why this is a *partial* split (the conservative-instinct read):** #1246 settled the *direction*, but the
bulk of the work is **cross-repo FUI build** (host ~14 demos, relocate bootstrap, stand up the block-vector
runner) that can't be delivered from the WE repo. Forcing those into WE "slices" now manufactures
fake agent-ready work that `/batch` would choke on (the investigation pass's explicit failure mode). So
carve the **3 genuinely-WE-deliverable slices**, and leave the gated remainder as tracked deferral in the
epic body, each with its FUI-side unblocking action.

> **No buried decision remains.** The `#701 iframe` vs `mode-C URL-bundle` choice in the body is a
> *settled menu* (both sanctioned by `#we-fui-embed-boundary` rule 6), picked per-demo at build time — not
> an open fork, so no `kind: decision` card is filed.

### Execution on `go` (post-#1246)
1. #1245 stays an **epic**; **drop its residual `size: 8`** (it gains children → a sized epic with sized
   children errors `check:standards`); clear `childlessReason: undecided` (the decision resolved); refresh
   digest to umbrella framing; update the body's "Slices to carve" → carved A/B/C + the deferred-gated list.
2. Scaffold **A, B, C** `--parent=1245` (no `--blocked-by` — all independent).
3. Gate `npm run check:standards`; confirm count +3.

---

# Focused: #1004 — Implement Web Charts (native-first SVG renderer + CustomChartRenderer registry)

`/slice 1004` — single-item run. Candidate: **#1004** (`kind: epic`, `relatedProject: webcharts`,
`tags: [webcharts, build]`, no children → unsliced-epic candidate kind **b**). Condition (1) settled
at the parent level; each slice verified against the real tree and rubric (2)–(5).

## Verdict: **could split** — 3 build slices + 1 carved placement decision; adapters deferred

### Investigation (work-investigation pass — file:line grounded)

Sibling template is **#1018** (webpositioning impl epic) + contract slice **#1048** — the *exact same
shape*: a CustomPositioner-family registry, native-first default, design delivered / impl gap. That
pair resolved **contract → `@webeverything`, runtime impl → FUI**. #1004 copies it.

Delivered design surface (confirmed present):
- `we:src/_data/projects/webcharts.json` — project node (`status: concept`).
- `we:src/_includes/project-webcharts.njk:71-169` — `ChartSpec` (L1 Vega-Lite profile) +
  `CustomChartRenderer` interface (`render(spec, theme, target) → ChartHandle`) + `ResolvedTheme`.
- `we:src/_data/protocols/custom-chart-renderer.json` — protocol (`ownedByProject: webcharts`,
  "same impl-swap shape as CustomPositioner / CustomTransportProvider").
- `we:src/_data/semantics/chart-encoding-semantic-plane.json` — semantic-plane glossary entry.
- `we:src/cases/webcharts/{01-semantic-fidelity,02-theme-application,03-a11y-description-table,04-a11y-graphics-roles}.html`
  — the four conformance vectors (all three scored axes covered).

Pattern sources for the impl:
- Contract+registry plugs: `we:src/_data/plugs/custompositioner.json`,
  `we:src/_data/plugs/custompositioningregistry.json`; contract types `we:positioning/contract.ts:1-84`.
- Reference renderers already in WE: `we:blocks/renderers/{data-table,pagination,reorderable-list}/`.
- Capability matrix: `we:src/_data/capabilityMatrix.json:38-65` (one `impls[]` row per resolver).
- Conformance-demo anatomy (3-file set JSON+HTML+TS, `setPlaygroundReady`):
  `we:src/_data/demos/analytics-conformance-demo.json` + `we:demos/analytics-conformance-demo.ts`;
  `we:src/_data/demos/webpositioning-conformance-demo.json` (the demo supplies its *own* in-demo impl).

Greenfield (what #1004 closes): `customchartrenderer*` plugs, the SVG renderer impl, the webcharts
conformance demo (none exist).

## Could split

| Slice | kind/size | Scope | blockedBy |
|---|---|---|---|
| **DEC — SVG renderer placement** | decision | Reconcile the protocol's "SVG renderer ships *with the standard*" wording against WE=contracts: native default impl → **FUI** (positioning precedent #1018/#1048, #817 runtime→FUI) **vs** → **WE `blocks/renderers/chart/`** (reference-renderer precedent — data-table/pagination/reorderable-list already live in WE). Genuine fork — epic body line 36-38 flags "flag, don't pre-decide". | — |
| **A — CustomChartRenderer registry runtime + contract** | story · 3 | Contract types (`CustomChartRenderer`, `ResolvedTheme`, `ChartHandle`; `ChartSpec` from semantics) → `@webeverything` + `we:src/_data/plugs/customchartrenderer.json` / `we:src/_data/plugs/customchartrenderregistry.json` plugs registration. Mirrors #1048 + `we:src/_data/plugs/custompositioningregistry.json`. **Contract→WE is settled** by #1018/#1048 (no fork in this slice). | — |
| **B — native-first SVG renderer (default impl)** | story · 5 | Consumes `ChartSpec` + resolved webtheme tokens → SVG; honours semantic/theme split; emits a11y `<table>` fallback (case 03) + WAI-ARIA Graphics roles (case 04). Placement per DEC. | A, DEC |
| **C — webcharts conformance demo** | story · 3 | 3-file demo running the four `src/cases/webcharts/*` against the SVG default, scoring semantic-fidelity / theme-application / a11y. Mirrors analytics/positioning demo anatomy. | B |

**DAG:** A and DEC both proceed immediately (≥2 independent ✓). B ← {A, DEC}; C ← B. Incremental
delivery holds — A ships the contract+registry artifact, B the default renderer, C the conformance
proof; each a valid standalone state.

## Could not split

| Scope | Failed condition | Unblocking action |
|---|---|---|
| **Optional adapters** (Vega / Plotly / ECharts behind the one contract) | (3) — three independent impls as one slice = another `size·8` lump | Carve **per-adapter** (one `story` each, `blockedBy: A`) once the contract lands and a concrete adapter demand exists. Left noted in the epic body, not scaffolded now (optional enhancement, not needed for a demoable end-state). |

## Notes
- #1004 is already an epic (kind b): no story→epic conversion, no residual `size` to drop.
- The **DEC** card de-buries the epic body's line 36-38 placement NB (inline NB → pointer to the card),
  per *decisions are work-items, not buried forks*. My lean on DEC: **FUI** (~75%; residual is the
  literal "ships with the standard" wording + the in-WE `blocks/renderers/*` counter-precedent).
- Slice A as a registry+contract standalone mirrors #1048 exactly (shipped as its own artifact); the
  existing `src/cases/webcharts/*` vectors are its consumer-facing proof, so it is **not** a
  registry-with-no-consumer dead end.

---

# Backlog split analysis — 2026-06-20 (focused: #1250)

`/slice 1250` — single-item run. Candidate: **#1250 — Re-reconcile FUI plugs UP to WE
(contract-anchored) + add a real plugs drift gate** (`kind: epic`, `size: 13`, `parent: 170`, no
children → unsliced-epic candidate kind **b**).

## Verdict: **could split** — 13 leaf slices (pure execution; #1270 resolved the direction + principles)

Governing decision **#1270 is resolved** (direction = reconcile FUI *up*; two principles =
contract-anchored + holes-get-fixed), so rubric (1) is settled at the parent AND no slice buries a
fork: #1270 explicitly rules the per-domain "who's right" determination **execution-by-contract, not a
decision**. This is **not** a roadmap "epic of epics" — every natural child is a leaf-level
reconcile/port/gate story, so ordinary `story`/`task` slices.

### Investigation (real tree, 2026-06-20)

- `we:plugs/` 14 domains vs `fui:plugs/` — confirmed drift by content-diff (not just file lists):
  - **10 domains content-differ**, 1–4 files each: webanalytics (1 diff + WE-only `we:plugs/webanalytics/CustomTrackerRegistry.ts`,
    FUI-only `fui:plugs/webanalytics/ga4/mixpanel/segment.ts`), webcontexts (4), webbehaviors (3), webdirectives (2 diff + 5
    WE-only), webexpressions (4 diff + 1 WE-only), webguards (2), webinjectors (2), webregistries (2 diff
    + 2 WE-only), webstates (1 diff + 4 WE-only), webvalidation (3 diff + 2 WE-only, also consumes
    published `@webeverything/*` contracts).
  - **2 WE-only domains, no FUI home** → full port: `we:plugs/webportals/` = **5** non-test `.ts`
    (`PortalDirective/PortalOutlet/Event.logical.patch/Node.logical.patch/index`), `we:plugs/webtraces/` = **1**
    (`we:plugs/webtraces/sessionReplayEnvelope.ts`). *(Body said "10 / 3 files" — stale; real surface is 5 / 1.)*
  - core + webcomponents: **0 drift** (identical) — no slice.
- **No plugs WE↔FUI drift gate exists.** `we:scripts/check-standards.mjs` §8b only checks dual-mode *test
  presence*; the blocks-side §8c (`we:scripts/check-standards.mjs:872`, #659) is the exact mirror to
  copy for a plugs contract↔impl drift check.
- Demoable states exist: `we:demos/analytics-conformance-demo.*`, `we:demos/webcontexts-demo.*`,
  `we:demos/webportals-conformance-demo.*`; conformance vectors in `we:conformance-vectors/`
  (`session-replay-envelope` = webtraces, `validator-resolution` = webvalidation, etc.) — note not every
  domain has a vector, which is where principle 2 (holes-get-fixed) bites.

> **No separate "contract-audit" slice.** The epic body framed slice 1 as a standalone audit that
> carves the rest — but an audit that mutates no impl leaves no demoable state (rubric 5). Instead each
> per-domain slice **starts** by auditing its own domain vs contract+vectors, then reconciles + fixes
> holes + demos. Self-contained and demoable. The proven pair (webanalytics #1014, webcontexts #1117)
> are already diagnosed, so they skip straight to the fix.

## Could split

| Slice | kind/size | Scope | blockedBy |
|---|---|---|---|
| **A — reconcile webanalytics** | story · 3 | Audit vs contract; add `UnknownTrackerError` + `CustomTrackerRegistry` to FUI (proven gap #1014); keep FUI's `ga4/mixpanel/segment`. Demo: `analytics-conformance-demo`. | — |
| **B — reconcile webcontexts** | story · 3 | `resolveContext` strict/flexible parity to FUI (proven gap #1117); 4 files. Demo: `webcontexts-demo`. | — |
| **C — reconcile webbehaviors** | story · 2 | Audit+reconcile `CustomAttribute(Registry)` + index (3 diffs). | — |
| **D — reconcile webdirectives** | story · 3 | Port 5 WE-only (`CustomComment*`, `multiTemplate`) + reconcile `CustomTemplateDirective` (2 diffs). | — |
| **E — reconcile webexpressions** | story · 3 | Port `ExplicitHTMLInsertion.patch` + reconcile 4 (`CustomTextNode*`, `UndeterminedTextNode`). | — |
| **F — reconcile webguards** | story · 2 | `CustomGuardRegistry` + index (2 diffs). | — |
| **G — reconcile webinjectors** | story · 2 | `InjectorRoot` + `Node.injectors.patch` (2 diffs). | — |
| **H — reconcile webregistries** | story · 3 | Port `ScopedRegistryAttribute` + `declarativeRegistry` + reconcile `CustomElementRegistry` (2 diffs). | — |
| **I — reconcile webstates** | story · 3 | Port 4 WE-only (`CustomChangeStrategy*`, `CustomStorageStrategy*`) + reconcile index. | — |
| **J — reconcile webvalidation** | story · 5 | Port 2 WE-only + reconcile 3 (`AsyncValidatorField`, `ValidityMergeField`); align FUI to consume published `@webeverything/*` contracts (#700/#872). | — |
| **K — port webportals → FUI** | story · 3 | Full port of 5 files contract-anchored; consumer `webportals-conformance-demo`. | — |
| **L — port webtraces → FUI** | story · 2 | Port `we:plugs/webtraces/sessionReplayEnvelope.ts`; vector `session-replay-envelope.vectors`. | — |
| **M — plugs WE↔FUI drift gate** | story · 3 | New `we:scripts/check-standards.mjs` section mirroring §8c/#659: fail on `we:plugs/<domain>` vs `fui:plugs/<domain>` divergence (detect-or-skip when FUI absent). | A–L |

**DAG:** A–L are **mutually independent** (disjoint domain dirs) → 12-wide parallel batch (≥2 independent
✓✓). **M ← {A…L}** — the gate must land *after* drift is resolved or it fails red (mirrors the §8c
hard-fail). External: **#1234** (final WE-side repoint) stays `blockedBy: 1250` — it waits on the whole
epic resolving; #1047 (delete `we:plugs/`) follows #1234.

## Could not split

| Scope | Failed condition | Unblocking action |
|---|---|---|
| *(none)* | — | All 13 slices ground in the real tree, size ≤ 5, no buried fork (#1270 resolved). |

## Notes
- #1250 is already an epic (kind b): no story→epic conversion; **drop residual `size: 13`** (else a
  sized epic with sized children double-counts → `check:standards` error).
- Per-domain grain (not grouped) is the batchable unit and matches the body's "one slice per drifted
  domain"; grouping would re-create `size·8` lumps. The 12 reconcile/port slices are exactly the kind of
  disjoint fan-out `/batch` (or `/workflow`) wants.
- Each per-domain slice's step 1 is its own contract audit (principle 1); contract holes found get a
  spec/vector added in the same slice (principle 2) — that's why no standalone audit slice.

---

# Focused: #1299 — webbehaviors reconcile drags a 51-file `target`→`ownerElement` migration

`/slice 1299` — single-item run. Candidate: **#1299 — Reconcile fui:plugs/webbehaviors UP to WE
(contract-anchored)** (`kind: story`, `size: 13`, `parent: 1250`, `locus: frontierui` → oversized-story
candidate kind **a**; already a child of the #1250 plugs-reconcile epic).

## Verdict: **could split** — alias-gated foundation + 5 parallel drain slices + 1 enforcement tail

The size came from **volume, not an open fork**: all three drivers are *resolved, contract-settled*
rulings — `whenDefined` (**#1119**), `target`→`ownerElement` rename (**#1121**, `target` branch ruled
broken, no alias), `#assertValidName` hyphen/`:` throw (**#1120**). Rubric (1) passes (no decision to
split away). The work is a cross-cutting consumer migration that becomes safely sliceable **once a
deprecated `target` alias is authored up front** (the rubric-(5) "shared fixture authored first" pattern)
— the alias keeps all consumers green so each area migrates independently and incrementally.

### Investigation correction — the body's "96 files / 36 source behaviors" overcounts

Grounded against the real `fui:` tree (`/Users/nicolasgilbert/workspace/frontierui`):

- **96** files match `.target`, but that conflates **three unrelated `target`s**: the CustomAttribute
  getter (`this.target`, the one #1121 renames), DOM `event.target` (25 files), and **`Injector.target`**
  — a *separate* public property (`fui:plugs/webinjectors/Injector.ts:69` `public target: Target`), **not**
  the CustomAttribute getter. webinjectors (9 files) is therefore **out of scope** for #1121.
- The real #1121 blast radius is the **CustomAttribute subclasses**: `this.target` appears in
  **~24 source files** — block behaviors that `extends CustomAttribute<…>`
  (`fui:blocks/droplist/Anchor.ts:51`, etc.) — plus the plug's 2 unit-test files and 5 demos with inline
  behavior classes. Per-area file counts (occurrences): droplist 8 (150), navigation 3 (16), router 2
  (8), tabs 1 (15), type-ahead 1 (11), view 4 (20), for-each 1 (3), temporal 3 (17), workflow-engine 1
  (2), data-grid 2 (14), attributes 1 (12), traits 4 (14).
- The WE plug already carries the target shape to reconcile *up* to:
  `we:plugs/webbehaviors/CustomAttribute.ts:209` (`get ownerElement()`), and #1120's spec at
  `we:src/_includes/project-webbehaviors.njk:83`. FUI still uses `target`
  (`fui:plugs/webbehaviors/CustomAttribute.ts:206`).

## Could split

Edge case (skill / *Executing a split*): **#1299 already has a `parent` (#1250)** → do **not** nest into a
sub-epic. Keep **#1299 a `story` re-sized to its core slice**, and add the rest as **siblings under
#1250**.

| Slice | kind · size | scope | blockedBy |
|---|---|---|---|
| **#1299** (retained core) | story · 3 | Plug reconcile: add `ownerElement` getter + keep a **deprecated `target` alias** (zero consumer breaks) + `whenDefined` (#1119) on `fui:plugs/webbehaviors/CustomAttribute.ts` + `fui:plugs/webbehaviors/CustomAttributeRegistry.ts` + `fui:plugs/webbehaviors/index.ts` doc-comments; update the 2 plug unit tests (`fui:plugs/webbehaviors/__tests__/unit/CustomAttribute.test.ts` + `fui:plugs/webbehaviors/__tests__/unit/CustomAttributeRegistry.test.ts`) to assert ownerElement + alias + whenDefined. **Foundation — alias keeps all 24 consumers green.** | — (already `parent: 1250`) |
| **A — droplist** | task · 3 | `this.target`→`this.ownerElement` across `fui:blocks/droplist/*` (8 files, ~150 occ) + its tests | #1299 |
| **B — navigation cluster** | task · 2 | `fui:blocks/{navigation,router,tabs,type-ahead}/*` (7 files) | #1299 |
| **C — view cluster** | task · 2 | `fui:blocks/{view,for-each,data-grid,attributes}/*` (8 files) | #1299 |
| **D — traits/temporal cluster** | task · 2 | `fui:blocks/{traits,temporal,workflow-engine}/*` (8 files) | #1299 |
| **E — demos** | story · 3 | inline-behavior `this.target`→`this.ownerElement` in `fui:demos/declarative-spa.html`, `fui:demos/declarative-spa-jsx.tsx`, `fui:demos/declarative-spa-unplugged.html`, `fui:demos/visibility-gate.ts`, `fui:demos/visibility-gate-heavy.ts` — **browser-verified on fui :3001** | #1299 |
| **F — enforce #1120 + drop alias** | story · 3 | audit every `define('…')` for bare names, rename bare→hyphenated (markup + companion `*-when` attrs + querySelectors), turn on the throwing `#assertValidName`, **remove the deprecated `target` alias** | #1299, A, B, C, D, E |

**DAG:** `#1299 → {A, B, C, D, E}` (5-wide parallel — disjoint block dirs, alias makes each independent
✓✓) `→ F` (consolidation tail — alias removal needs every getter usage drained *and* every bare name
renamed). Acyclic; ≥2 independent ✓; incremental delivery ✓ (each of A–E ships valid via the alias).

## Could not split

| Scope | Failed condition | Unblocking action |
|---|---|---|
| *(none)* | — | All drivers resolved (#1119/#1120/#1121); seams grounded in the real tree; alias makes each slice independently demoable. |

## Notes
- The split is **only safe because of the up-front `target` alias** in #1299 — without it, any partial
  migration leaves behaviors calling a renamed-away getter (rubric 5 broken state). The alias is the
  "shared fixture authored first" that licenses the fan-out; F removes it last.
- **#1299 stays a `story`** (not converted to an epic) because it already has `parent: 1250` — A–F are
  scaffolded as siblings under #1250, not nested under #1299.
- Re-size **#1299 `13` → `3`** (its retained scope is just the plug + alias, not the whole migration).
- webinjectors is **excluded** from the rename (own `Injector.target`); a body framing of "96 files" /
  "36 source behaviors" should not pull it in.

---

# Backlog split analysis — 2026-06-20 (focused: #1289)

`/slice 1289` — single-item run. Candidate: **#1289 — FUI graph/node-viz block — gap blocking
plateau-app Platform Map dogfood** (`kind: story`, `size: 13`, `locus: frontierui`, no `parent` →
oversized-story candidate kind **a**).

## Verdict: **could not split** — `foundational`; the build surface doesn't exist yet

#1289 is a **pure gap-marker for a greenfield block**, not a sized pile of independent work. Its `13`
came from a batch pre-flight (sized 8 → 13) recording *uncertainty*, not *volume* — exactly what
rubric (1) forbids splitting away.

Work-investigation pass:

- **No FUI viz primitive to build on.** FUI's only "graph" references in `fui:src/_data/blocks.json`
  are the Workflow-Engine's SCXML *workflow* graph (`flow-progress`, `NativeWorkflowEngine`) — there is
  **no node/edge-visualization block** to extend or scaffold from. Confirmed by grep over the catalog.
- **No spec/acceptance exists.** The card defines no API, no layout algorithm (force-directed? layered
  DAG?), no node/edge data contract, no interaction model, and no graph-a11y story (genuinely hard).
  The build seams are therefore **not `file:line`-citable in any real tree** — the only concrete code
  is the *consumer* it would replace (`plateau:src/platform-manager/platform-map.ts`, a hand-rolled
  deterministic-column SVG layout over the #442 aggregated model), which is in plateau-app, not FUI.
- The card itself states it needs a `/new-standard` (or design) pass to define the contract + scope
  **before any build slice** — i.e. it is below DoR as one item.

Rubric outcome:

| Condition | Holds? | Why |
|---|---|---|
| (1) Volume not uncertainty | ✗ | Size is "no spec" uncertainty; you can't slice away a missing contract. |
| (3) Slices land small, files grounded | ✗ | No spec + no FUI viz primitive ⇒ no slice's named files are `file:line`-citable. |
| (5) Every slice demoable | ✗ | Nothing demoable until the contract exists; a "spec" slice + a "build" slice would be a rigid 2-chain with the build un-investigable. |

The open scoping question the body carries — *build the FUI block vs. accept the Platform Map's
hand-rolled viz as a documented standing gap* — is explicitly **prioritization, not a design fork**
(whether to do the work at all, decided at prioritization time per first-party-dogfood). It is **not** a
buried `kind: decision` to carve (cost/effort/whether-to-do is prioritization, never a fork), so no
decision card is filed and `blockedBy` stays empty.

## Could not split

| #NNN | Title | Failed condition | Unblocking action |
|---|---|---|---|
| #1289 | FUI graph/node-viz block gap | (1) uncertainty-sized · (3) no grounded surface · (5) no demoable intermediate | Run a `/new-standard` (or design) pass to define the graph-viz block's contract + scope (API · layout algorithm · node/edge data contract · interaction model · graph-a11y). **This story IS that foundational slice** — re-run `/split` once the spec lands and the build seams are exposed. |

## Disposition

Set **`unsplittableReason: foundational`** on #1289 to clear its deterministic split badge (mirrors
sibling-class handling; keeps the body note for detail). No backlog mutation beyond the flag — no
slices, no decision card, no epic conversion.

> **Contrast with sibling #1286** (same batch, same gap class): #1286 *is* splittable — it bundles **4
> independent greenfield form-controls** (radio/checkbox/text-field/number) each mapping to an existing
> `we:intents/{input,selection}.json` contract, so its slices have a real spec to build against. #1289
> has **no** such contract yet — that's the whole difference, and the reason one splits and the other is
> `foundational`.

---

# Focused: #1286 — FUI form-control blocks (radio, checkbox, text-field, number input)

`/slice 1286` — single-item run. Candidate: **#1286** (`kind: story`, `size: 13`, `locus: frontierui`,
no `parent` → oversized-story candidate kind **a**, in the *should-split* band).

## Verdict: **could split** — 4 independent greenfield control builds, one per control, each `size 3`

The card is a pure gap-marker for **4 from-scratch a11y form-control components** that FUI does not ship.
This is *volume, not uncertainty* — the contracts the controls implement already exist as ratified WE
intents, so there is no buried design fork to scatter (rubric 1 ✓). Each control is its own block dir,
demo, and `fui:src/_data/blocks.json` entry — fully independent, no shared dependency, all four parallel-batchable.

### Investigation (work-investigation pass — file:line grounded, 2026-06-20)

- **FUI ships none of the four.** `fui:src/_data/blocks.json` enumerates 42 block ids
  (`card`…`deck`); a grep for `radio|checkbox|text-field|number` returns **zero** — only
  `fui:blocks/droplist/` (selection family) and `fui:blocks/rich-text-editor/` exist near this space.
  Confirms the gap-marker premise.
- **The contracts already exist (no design pass needed).**
  - **Input intent** — `we:src/_data/intents/input.json:1` (`variant`/`affordances`/`status` dimensions
    + `InputIntent` protocol). Covers **text-field** and **number input**.
  - **Selection intent** — `we:src/_data/intents/selection.json:1` (`model`/`immediacy`/`variant`
    dimensions). Its own description maps `single`→**Radio** and `multiple`→**Checkbox**
    (`we:src/_data/intents/selection.json:41`).
- **Per-control size is grounded in a real comparable.** A simple FUI control = one CustomElement file
  + `fui:blocks/button/index.ts` + a demo + a `fui:src/_data/blocks.json` entry. The closest shipped analog is the Button block:
  `fui:blocks/button/Button.ts` is **158 lines** (`fui:blocks/button/index.ts`, demo
  `fui:blocks/button/webcomponents-chrome-demo.html`, entry `fui:src/_data/blocks.json:448`). Each form control is of
  comparable or simpler scope (a native `<input>`/`<input type=…>` wrapper + a11y + tests) → **`size 3`**
  each, well under the batchable ceiling. (The droplist's multi-file 30KB+ scope is *not* the comparable —
  these are simple controls.)
- **No shared base to thread between them.** FUI has no form-control primitive, so each is built
  standalone; there is no extraction edge forcing a chain (keeping them independent is also the
  most-flexible default — they fan out 4-wide).

### Slice-to-intent mapping

| Slice | control | intent it implements | new home |
|---|---|---|---|
| A | radio | selection (`model:single`, `variant:item`) | `fui:blocks/radio/` |
| B | checkbox | selection (`model:multiple`, `variant:boolean`) | `fui:blocks/checkbox/` |
| C | single-line text-field | input (`variant`, `status`) | `fui:blocks/text-field/` |
| D | number input | input (`variant`, `status`) | `fui:blocks/number-input/` |

## Could split

| Slice | kind · size | scope | blockedBy |
|---|---|---|---|
| **A — radio** | story · 3 | Greenfield `fui:blocks/radio/` CustomElement (`<input type=radio>` group + roving-tabindex a11y) implementing the **selection** intent (`single`/`item`); unit + e2e tests; `fui:src/_data/blocks.json` entry (passes #784 completeness gate); demo. | — |
| **B — checkbox** | story · 3 | Greenfield `fui:blocks/checkbox/` CustomElement (`<input type=checkbox>` + indeterminate + a11y) implementing **selection** (`multiple`/`boolean`); tests; `fui:src/_data/blocks.json` entry; demo. | — |
| **C — text-field** | story · 3 | Greenfield `fui:blocks/text-field/` single-line CustomElement implementing **input** (`variant`/`affordances`/`status`, label/error a11y); tests; `fui:src/_data/blocks.json` entry; demo. | — |
| **D — number-input** | story · 3 | Greenfield `fui:blocks/number-input/` CustomElement (`<input type=number>` / spinner + `Intl`-aware) implementing **input**; tests; `fui:src/_data/blocks.json` entry; demo. | — |

**DAG:** `#1286 → {A, B, C, D}` — **4-wide parallel**, no inter-slice edges (disjoint block dirs, no
shared base). Acyclic ✓; ≥2 independent ✓✓✓✓; each ships a valid demoable state on its own (own demo +
`fui:src/_data/blocks.json` entry) ✓. All four are immediately batchable.

> Downstream (not part of this split): all four shipped unblocks the two #1254 configurator-migration
> slices (`we:plateau:src/intent-configurator/configurator.ts`,
> `we:plateau:src/technical-configurator/configurator.ts`) that are currently hand-rolled over the missing
> controls.

## Could not split

| Scope | Failed condition | Unblocking action |
|---|---|---|
| *(none)* | — | Contracts ratified (input/selection intents); no buried fork; per-control seams grounded in the real tree; each slice independently demoable. |

## Notes
- Rubric: (1) ✓ volume not a decision — intents pre-exist; (2) ✓ 4 nameable slices, each its own block
  dir; (3) ✓ each `size 3`, grounded in the Button comparable; (4) ✓ clean 4-wide parallel DAG; (5) ✓
  each leaves a valid demoable state (own demo + #784 catalog entry).
- On `go`: convert **#1286 → storied epic** (drop `size`, umbrella digest), scaffold A–D as `story·3`
  children, no `blocked-by` edges. Net flow **+4**.
- Same class as sibling gap **#1289** (graph/node-viz) — but #1289 stays **could-not-split** (it buries an
  open scoping question + has no spec/primitive, rubric 1+2), whereas #1286 has ratified contracts and is
  pure build volume.

---

# Focused: #1327 — Semantics glossary comprehensiveness (audit + gate)

`/split 1327` — single-item run. Candidate: **#1327** (`kind: story`, `size: 13`, no `relatedProject`,
no children) → oversized-story candidate kind **a**.

## Verdict: **could NOT split** — the size is driven by an undecided scope fork, not pure volume

### Investigation (real tree, 2026-06-20)

- The glossary lives at `we:src/_data/semantics/*.json` (**203** term files), rendered by
  `we:src/semantics.njk`. The gate already has a semantics-hygiene block at
  `we:scripts/check-standards.mjs:248` (`loadSemantics`, term/definition presence + dup-term check) —
  the natural home for a stream-2 coverage rule.
- The audit's category counts match the real tree exactly:
  `we:src/_data/{intents,blocks,protocols,plugs,capabilities}` = **68 / 80 / 36 / 53 / 21**. So the gap
  measurement (46 / 60 / 29 / 53 / 0 missing) is sound, and the work *is* investigable.
- Lineage confirmed: **#1319 resolved** (codified `decompose-overloaded-vocabulary-by-semantic-source`
  in `we:docs/agent/platform-decisions.md`), **#1325 resolved** (minted `we:src/_data/intents/tag.json`).
  Both are downstream of the same overloaded-vocabulary thread #1327 serves.

### Why rubric (1) fails — size is gated by an unresolved decision

#1327's own body surfaces a load-bearing fork and **explicitly refuses to resolve it inline**:

> the load-bearing fork is **what the semantics glossary is the vocabulary _of_** — concept-only
> (intents + protocols) vs every-named-standard — and it determines (a) the backfill volume and (b) the
> gate's fire-set. … Surfaced and **not** decided here.

The fork has two coherent competing end-states, and **the slice shape is a function of the answer**, so
the seams can't be drawn yet:

| End-state | Backfill volume | Stream-2 gate fire-set |
|---|---|---|
| **Concept-only** (intents + protocols) | ≈ **75** (46 intents + 29 protocols) | intent + protocol categories only |
| **Every-named-standard** | ≈ **188** (+ 60 blocks + 53 plugs) | all five — which the body itself flags as likely "all-warn-noise" for the `Custom*` plugs / concrete block impls catalogued on `/plugs/` and `/blocks/`, not ubiquitous language |

The slices the body sketches (`1a` backfill-the-in-scope-category, `1b`/`2` the scoped gate) are
well-formed **only once the in-scope category set is fixed** — their `size`, fire-set, and even *count*
all move with the decision. Proposing them now is guessing the seam, which the work-investigation pass
forbids. (The body's "derive-vs-hand-author" is a real but minor sub-call; the load-bearing fork is the
scope partition, as the body says — and it even prescribes the path: `/decision` on the scope fork
**first**, then `/slice`.)

### Could-not-split table

| # | Failed condition | Why | Unblocking action |
|---|---|---|---|
| **#1327** | **(1) size is volume, not an unresolved decision** | The 13 bundles a scope **decision** with a two-stream build; literal scope is ~188 entries; slice boundaries depend on the decision's outcome. | **Resolve the scope decision first.** File the buried fork as its own `type:decision` card; de-bury #1327 (inline fork → pointer); leave #1327 `status: open`, `size 13`, `story`. Then re-run `/slice 1327`. |

### The fix this analysis applies (gated on go — not a split)

Per *backlog-workflow.md → Where an open question goes* and
[[feedback_decisions_are_workitems_not_plan_mode]] / [[feedback_misflagged_batchable_fix_real_state]] —
a buried fork doesn't license leaving it in the parent body:

1. **File a `type:decision` card** (next free NNN) — *"What is the semantics glossary the vocabulary
   _of_? — concept-only (intents+protocols) vs every-named-standard"*. Forks: scope set → (a) backfill
   volume, (b) stream-2 gate fire-set. Seed with the audit numbers + the **#1319** precedent
   (`decompose-overloaded-vocabulary-by-semantic-source` — same partition-by-semantic-source instinct, a
   prior for the concept-only branch). Register Tier-B (`status: open`).
2. **De-bury #1327** — replace its "Surfaced scope decision" section with a one-line pointer to the card;
   set `blockedBy: ["<card NNN>"]`; keep `size 13`, `story`, `status: open`.

My lean on the eventual decision: **concept-only** (~70%) — the glossary is *ubiquitous language*, and
`Custom*` plug class names + concrete block impls are catalogued elsewhere; gating on all 188 is the
body's own predicted noise failure. Residual: blocks split between genuine concept blocks (few) and
concrete impls — the block category may want a partial-inclusion rule, which the decision card settles.

## Net

0 slices. Proposed mutation (gated on go): **+1 `type:decision` card**, **de-bury #1327** (+ `blockedBy`
edge). No conversion to epic, no resize.

---

# Focused: #1306 — Reconcile fui:plugs/webvalidation UP to WE (contract-anchored)

`/slice 1306` — single-item run. Candidate: **#1306** (`kind: story`, `size: 13`, `parent: 1250`,
`locus: frontierui`) — an oversized story that already **outgrew a batch slot** (5→13, batch-2026-06-20)
with a diffed-only investigation in its body. Already parented (a leaf slice of #1250) → **edge case:
don't nest a new epic; keep #1306 a re-sized `story` for its core slice, add the rest as siblings under
#1250.**

## Verdict: **could split** — alias-prereq + WE-only port + 2 field reconciles; clean DAG, 2 independent roots

### Investigation (work-investigation pass — file:line grounded, both repos, nothing modified)

The body's diffed-only note was directionally right but imprecise on two counts (verified against the
real tree): the index needs *additive* export wiring (not "no-op"), and the field divergence is far
larger on `ValidityMergeField` than the body's "109-line" estimate.

WE plug (8 non-test TypeScript files) under `we:plugs/webvalidation/` —
`we:plugs/webvalidation/AsyncValidatorField.ts` (220), `we:plugs/webvalidation/ValidityMergeField.ts`
(343), `we:plugs/webvalidation/CustomCommitmentPolicyRegistry.ts` (70, **WE-only**),
`we:plugs/webvalidation/ValidationErrorSummary.ts` (143, **WE-only**),
`we:plugs/webvalidation/CustomValidatorResolutionRegistry.ts`,
`we:plugs/webvalidation/CustomValidityMergeRegistry.ts`, `we:plugs/webvalidation/applyMergedValidity.ts`,
`we:plugs/webvalidation/index.ts` (182).

FUI plug (6 non-test TypeScript files) under `fui:plugs/webvalidation/` — same minus the 2 WE-only files;
`fui:plugs/webvalidation/AsyncValidatorField.ts` (200), `fui:plugs/webvalidation/ValidityMergeField.ts`
(192), `fui:plugs/webvalidation/index.ts` (173).

Grounded seams:
- **Alias prereq.** The 2 WE-only files import WE *root* modules — `we:plugs/webvalidation/CustomCommitmentPolicyRegistry.ts:20-21`
  → `we:commitment-policy/index.ts` + `we:commitment-policy/registry.ts`; `we:plugs/webvalidation/ValidationErrorSummary.ts:15-16`
  → `we:error-summary/index.ts`. FUI has **no** local `commitment-policy/` or `error-summary/` root tree.
  Aliases `@webeverything/commitment-policy` / `@webeverything/error-summary` are **not** in
  `fui:tsconfig.json` (lines 18-75 already declare 40+ `@webeverything/*` sibling aliases, e.g.
  `fui:tsconfig.json:36` capability-manifest, `:37-41` validation-generation/{provider,registry,…}).
  Adding two follows that exact established pattern — **alias→sibling WE tree, no local copy** (the
  #700/#872 contract-consumption direction this card's own goal names). *Alias-vs-local-copy is settled
  by precedent, not a live fork.*
- **WE-only port + index.** `fui:plugs/webvalidation/index.ts` already consumes `@webeverything/*`
  aliases (`:82` etc.) — those lines are **correct, preserve them** — but it is **missing** the 3 new
  exports WE added (`we:plugs/webvalidation/index.ts:25-32`: `CustomCommitmentPolicyRegistry`,
  `createDefaultCommitmentPolicyRegistry`, `ValidationErrorSummary`). So porting the 2 files **includes**
  adding their exports — index wiring folds into the port, not a separate slice.
- **`ValidityMergeField` reconcile (the core, +151).** WE 343 vs FUI 192. WE-only: `#1113` commitment
  scope (`resolveCommitmentRegistry()` `:47-52`, `static observedAttributes=['strategy','commitment']`
  `:59` vs FUI's `['strategy']`, `#resolveCommitment`/`#reflectStaleness` `:163-191`), interaction-state
  tracking (`:73-83`, `:267-296`), `#1111` transition events (`:299-324`). **Imports
  `CustomCommitmentPolicyRegistry`** (`:28`) → blocked by the port.
- **`AsyncValidatorField` reconcile (+20, independent).** WE 220 vs FUI 200; WE-only `#runVersion`
  (`:68-69`), validate-start/end emission (`:122-135`), `#emitControl()` (`:137-140`). Its imports
  (validity-merge/registry, validator-resolution, InjectorRoot, CustomValidatorResolutionRegistry) **all
  exist in FUI** → no commitment dependency, proceeds in parallel.

### Could split

| Slice | kind/size | Scope | blockedBy |
|---|---|---|---|
| **A — wire 2 contract aliases** | task · 2 | Add `@webeverything/commitment-policy` + `@webeverything/error-summary` to `fui:tsconfig.json` (+ any vite/build mirror), pointing at the sibling WE root trees — same pattern as the existing 40+ `@webeverything/*` entries. Foundational. | — |
| **B — port 2 WE-only files + wire index exports** | story · 3 | Contract-audit then port `we:plugs/webvalidation/CustomCommitmentPolicyRegistry.ts` (70) + `we:plugs/webvalidation/ValidationErrorSummary.ts` (143) into `fui:plugs/webvalidation/`; add their 3 exports to `fui:plugs/webvalidation/index.ts` **preserving** its `@webeverything/*` alias imports (do not blind-copy WE's relative-path index). | A |
| **#1306 (core, re-sized) — reconcile `ValidityMergeField` up** | story · 5 | Hand-merge `fui:plugs/webvalidation/ValidityMergeField.ts` up to WE (+151: #1113 commitment scope + interaction-state + #1111 transitions), preserving FUI's observed-attributes/runner bits; contract-anchored audit first (#1270 principle 1). Imports the ported `CustomCommitmentPolicyRegistry`. | B |
| **C — reconcile `AsyncValidatorField` up** | task · 2 | Hand-merge `fui:plugs/webvalidation/AsyncValidatorField.ts` up to WE (+20: #1111 #runVersion + validate-start/end + #emitControl), preserving FUI's `#ensureRunner().validate(...)`. Independent (no commitment dep). | — |

**DAG:** **A** and **C** both proceed immediately (≥2 independent roots ✓ rubric 4); B ← A; #1306-core
← B. Incremental delivery holds — each slice leaves FUI building green with a coherent reconcile
increment (A: aliases declared; B: the 2 registries available + exported, matching WE; #1306: merge
field up; C: async field up). No half-protocol intermediate.

## Could not split

| Scope | Failed condition | Unblocking action |
|---|---|---|
| Splitting **B** per-file (CustomCommitmentPolicyRegistry vs ValidationErrorSummary) | none failed — but two ~70/143-line clean ports of the *same nature* (WE-only file + its alias + its index export) are more coherent as one `size 3` slice than two `size 1` fragments | Left as one slice. If a future blocker hits only one, re-`/slice` B then. |

## Notes
- **Edge case applied:** #1306 already has `parent: 1250`, so it is **not** converted to an epic. It
  stays a `story`, **re-sized 13 → 5**, scope narrowed to the `ValidityMergeField` core reconcile, and
  gets `blockedBy: [B]`. Slices A, B, C scaffold as **new siblings under #1250**.
- **No buried fork.** The only candidate fork (alias vs FUI-local copy for the 2 root modules) is settled
  by the established `fui:tsconfig.json` precedent + this card's own #700/#872 goal → alias. The
  "audit-first" per slice is #1270 principle 1, not an open decision.
- Net on approval: **+3 siblings** under #1250 (A task, B story, C task), #1306 resized story→story (no
  epic conversion), one `blockedBy` edge added. #1250 child count 13 → 16.

## Net

4 slices total from #1306 (1 stays as the resized original + 3 new siblings). Proposed mutation (gated
on go): scaffold A/B/C under #1250, resize #1306 to `size 5` + narrow digest + `blockedBy: [B]`.


---

# `/slice 1333` — single-item run (focused)

Candidate: **#1333 — Enforce #1120 name-validation throw + drop the deprecated target alias
(fui:webbehaviors)** (`kind: story`, `size: 13`, `parent: 1250`, `locus: frontierui`, oversized-story
candidate kind **a**). Pre-flagged by `batch-2026-06-20b` as "not batchable as one" (size 3 → 13).

## Verdict: **splits — partial** (1 core slice ships now · 1 slice gated behind a carved decision)

### Work-investigation pass — the body's premise is wrong by *conflation*, not just stale

The pre-flight note claims **~42 remaining `this.target` alias consumers**. That number is a
**conflation of four distinct `target` fields** and does not survive the grep:

| `target` field | where | is it the CustomAttribute alias #1333 targets? |
|---|---|---|
| `CustomAttribute#target` deprecated `target` getter | `fui:plugs/webbehaviors/CustomAttribute.ts:221` | **yes** — the actual target |
| `Injector.target` (own field) | `fui:plugs/webinjectors/*` (HTMLInjector + 7 tests) | no — Injector's own `target` (note already excludes) |
| `CustomContext#target` (own field) | `fui:plugs/webcontexts/CustomContext.ts:79,137` | no — context's own field |
| `portal-directive` `target` IDREF attr | `fui:plugs/webportals/PortalDirective.ts:103,114` | no — outlet IDREF attribute |
| xstate transition `target` | `fui:blocks/workflow-engine/*` (NativeWorkflowEngine, xstateAdapter/Runtime) | no — state-machine target (#1331 already excluded) |

**Filtering to true `extends CustomAttribute` + `this.target` alias use, the complete remaining FUI
surface is the base class + 4 test files — not 42:**

- **Base class self-consumption** — `fui:plugs/webbehaviors/CustomAttribute.ts` (5 uses: `:156-157`
  `this.target.setAttribute`, `:265,:268` in `localName`). The alias getter can't be removed until the
  class stops self-consuming it.
- **4 test/e2e files** defining inline behaviors on `this.target`:
  `fui:plugs/__tests__/unplugged.e2e.test.ts` (10), `fui:plugs/__tests__/unplugged.integration.test.ts`
  (5), `fui:plugs/__tests__/e2e/webbehaviors-simple.spec.ts` (4),
  `fui:plugs/webbehaviors/__tests__/unit/CustomAttributeRegistry.test.ts` (2).
- **`blocks/` is fully drained already** — a `extends CustomAttribute` ∧ `this.target` sweep of
  `fui:blocks/` returns **zero** un-migrated consumers. Migration slices #1330–1332 (resolved) drained
  every behaviour subclass (view/for-each/data-grid/attributes, traits/temporal, navigation/router/tabs/
  type-ahead, droplist). So the alias drop is **not** repo-wide — it's bounded to one class + tests.

### The card bundles two *orthogonal* concerns + one real decision

The title literally names two unrelated platform changes welded together:

1. **#1121 alias drop** (`target` → `ownerElement`, drop the deprecated getter) — **no fork, fully
   independent** of any naming question. Mechanical; mirrors #1330–1332. Drain the base class's 5
   self-uses + the 4 test files, then delete the `@deprecated target` getter
   (`fui:plugs/webbehaviors/CustomAttribute.ts:221`).
2. **#1120 throw flip** (turn on the throwing `#assertValidName` + rename bare `define()` names) —
   **gated by a genuine decision** (rubric 1).

### The buried fork is real (rubric 1 — you cannot split it away)

WE's #1120 (resolved, `we:plugs/webbehaviors/CustomAttributeRegistry.ts`) added a hyphen-**OR**-colon
`#assertValidName` guard **on `CustomAttributeRegistry.define()/defineLazy()` only**. The FUI bare names
the note worries about are **not CustomAttribute names** — they're registered in *different registries*:

```
fui:plugs/bootstrap.ts:190-192  expressionParsers.define('value'|'pipe'|'call', …)   <- CustomExpressionParserRegistry
fui:plugs/bootstrap.ts:200-201  textNodeParsers.define('mustache'|'polymer', …)       <- CustomTextNodeParserRegistry
fui:plugs/bootstrap.ts:211-212  textNodes.define('mustache'|'polymer', …)             <- CustomTextNodeRegistry
```

Single-word tokens (`value`, `pipe`, `mustache`) are the **established grammar** of those parser
registries. Whether #1120's hyphenate/throw rule extends to them or stays scoped to `CustomAttribute`
is **undecided**, and it sets the rename scope of the throw-flip slice. Per rubric (1) this fork must be
**carved into its own `kind: decision` item**, not scattered across slices.

### Could split

| Slice | kind/size | Scope | blockedBy |
|---|---|---|---|
| **#1333 (core, re-scoped) — drop the deprecated CustomAttribute `target` alias (FUI)** | story · 2 | Drain the base class's 5 self-uses + the 4 test files off `this.target` -> `this.#target`/`ownerElement`; delete the `@deprecated target` getter at `fui:plugs/webbehaviors/CustomAttribute.ts:221`. Closes the #1299 `target`-alias carve. | — (blockers #1299/#1328–1332 all resolved) |
| **D — decision: does #1120 name-validation apply beyond CustomAttribute?** | decision · — | Fork: **(a)** `CustomAttribute`-only — the throw stays on `CustomAttributeRegistry`; `value`/`pipe`/`mustache` keep their bare parser-grammar names. **(b)** all `define()`-bearing registries hyphenate/colon-namespace. Seed with `fui:plugs/bootstrap.ts:190-212` + #1120's hyphen-OR-colon precedent. **Lean: (a) ~75%** — #1120's guard already lives only on `CustomAttributeRegistry`; the parser tokens are a deliberate single-word grammar, not HTML-attr-colliding names. | — |
| **E — turn on the throwing #assertValidName in FUI + rename in-scope bare CA names** | story · 2 | Mirror WE #1120 (size 2) into `fui:plugs/webbehaviors/CustomAttributeRegistry.ts`; rename whichever bare names D rules in-scope (markup + companion `*-when` attrs + querySelectors). | D |

**DAG:** **#1333-core** and **D** both proceed immediately (>=2 independent roots, rubric 4); **E <- D**.
Incremental delivery holds — #1333-core leaves the alias gone + webbehaviors suite green; E leaves the
throw on + names valid + suite green. No half-protocol intermediate (rubric 5).

### Notes
- **Edge case applied:** #1333 already has `parent: 1250`, so it is **not** converted to an epic. It
  stays a `story`, **re-sized 13 -> 2**, scope narrowed to the alias drop, digest rewritten, and its
  inline fork replaced by a pointer to **D**. Slices **D** (decision) and **E** (story) scaffold as
  **new siblings under #1250**.
- **Rubric (1) honoured:** the naming-scope fork is carved into its own `kind: decision` item (**D**),
  not left buried in #1333's body; **E** `blockedBy` **D**. `unsplittableReason` does **not** apply — the
  item *split*; the gated slice waits on a real decision edge, not an atomic verdict.

## Net

`/slice 1333` -> **+2 items** (D decision + E story under #1250), #1333 resized `story 13 -> 2` (no epic
conversion, core = the alias drop). #1250 child count rises by 2. Slices `#1333-core` and **D** are
immediately actionable; **E** unlocks when **D** ratifies. Mutation gated on **go**.

---

# Focused: #1304 — Reconcile fui:plugs/webregistries UP to WE (contract-anchored)

`/split 1304` — single-item run. Candidate: **#1304** (`kind: story`, `size: 13`, `parent: 1250`,
`locus: frontierui`) — an oversized story that already **outgrew a batch slot** (3→13, batch-2026-06-20)
with a carried-forward investigation flagging a genuine `downgrade()` fork. Already parented (a leaf
slice of #1250) → **edge case: don't nest a new epic; keep #1304 a re-sized `story` for its core slice,
add the rest as siblings under #1250.**

## Verdict: **could split** — carve the (cross-repo) downgrade decision + 1 batchable clean-improvements slice; the declarative/patching reconcile stays the focused core

The card's "port ScopedRegistryAttribute + declarativeRegistry + reconcile CustomElementRegistry (2
diffs)" framing **badly undercounts** the real surface, and the carried-forward investigation under-scoped
the `downgrade` fork as "a FUI-architecture decision." Grounding both trees corrected both.

### Investigation (work-investigation pass — file:line grounded, both repos, nothing modified)

FUI's webregistries is **far** behind WE — not "2 diffs". Four distinct workstreams:

1. **`we:plugs/webregistries/CustomElementRegistry.ts` clean improvements (resolved, no fork).** FUI is missing #1101
   `whenDefined` real promise (`fui:plugs/webregistries/CustomElementRegistry.ts:134-137` still
   reject-stub), #1102 `#getStandInElement` extraction + duplicate-define guard
   (`fui:plugs/webregistries/CustomElementRegistry.ts:110-118` TODO stub, `:80` `// TODO: Validate…`). WE has both
   (`we:plugs/webregistries/CustomElementRegistry.ts:79-98,129-162,180-190`). These adopt cleanly
   **while preserving FUI's `downgrade`**.
2. **`we:plugs/webregistries/index.ts` #1100 global patching — entirely unimplemented in FUI.** `applyPatches` /
   `removePatches` / `isPatched` are all `console.warn('not yet implemented')` TODO stubs
   (`fui:plugs/webregistries/index.ts:24-64`); WE ships the full save-restore + `attachShadow` scoped-init
   patch (`we:plugs/webregistries/index.ts:30-128`).
3. **`#854` declarative scoped registration — two WE-only files missing entirely.**
   `we:plugs/webregistries/ScopedRegistryAttribute.ts` (2.4 KB) + `we:plugs/webregistries/declarativeRegistry.ts`
   (14.5 KB, ~400 lines, #900/#901) have **no FUI home**; WE's `we:plugs/webregistries/index.ts:11-35` exports them.
   The card's own note: WE's `we:plugs/webregistries/__tests__/unit/declarativeRegistry.test.ts` "binds the host on attach" **fails bound=false**
   when run against FUI — the MOMENT-2 binding needs FUI-side integration, not a copy.
4. **The `downgrade` fork — and it lives in the SHARED core, not just FUI.** This is the load-bearing
   correction:
   - `we:plugs/core/Plug.ts` (the `Plug` interface requiring `localName + upgrade + downgrade`, with an
     `isPlug` guard checking all three) and `we:plugs/core/HTMLRegistry.ts` (`abstract downgrade(node)`,
     `:27`) are **byte-identical in WE and FUI** (`diff -rq plugs/core/` = only one unrelated test
     differs). So is `we:plugs/unplugged.ts` (`register()` → `isPlug` → throws without `downgrade`).
   - #1103 dropped `downgrade()` from **WE's** `CustomElementRegistry` (native-first) but **never
     reconciled the shared `Plug`/`HTMLRegistry`/`isPlug` contract that still requires it.**
   - **Consequence — WE is currently RED.** `npx vitest run we:plugs/webregistries/__tests__/unit/webregistries.unplugged.test.ts`
     → *"Cannot register plug: object must implement the Plug interface (localName, upgrade, downgrade)"*
     at `we:plugs/webregistries/__tests__/unit/webregistries.unplugged.test.ts:22`. WE's own unplugged
     test fails because #1103's drop wasn't carried through the shared contract.
   - So "FUI can't adopt WE's surface" is the *symptom*; the real fork is **should the shared `Plug`
     contract drop the `downgrade` requirement to match #1103 (native-first), or keep it** — a cross-repo
     `core/` decision, with a live WE regression riding on the answer. This is exactly the buried fork the
     rubric says to carve (not a FUI-only call), per [[feedback_decisions_are_workitems_not_plan_mode]] /
     [[feedback_misflagged_batchable_fix_real_state]].

### Could split

Edge case (skill / *Executing a split*): **#1304 already has a `parent` (#1250)** → keep **#1304 a
`story` re-sized to its core slice**, add the rest as **siblings under #1250**.

| Slice | kind · size | scope | blockedBy |
|---|---|---|---|
| **DEC — drop the shared `Plug.downgrade` requirement?** | `type:decision` | Reconcile the #1103 native-first drop against the shared plug contract. Fork: **(A) drop `downgrade` from `Plug`/`HTMLRegistry`/`isPlug`** (in *both* repos — identical files) so the polyfill surface matches native + #1103, fixing WE's live red test, **vs (B) keep the requirement** and have `CustomElementRegistry` retain a downgrade member. Surfaces the live `we:plugs/webregistries/__tests__/unit/webregistries.unplugged.test.ts` regression. Does **not** block the reconcile slices below (they preserve FUI's `downgrade`). | — |
| **A — CustomElementRegistry clean improvements** | task · 3 | Contract-audit then port #1101 `whenDefined` real promise + #1102 `#getStandInElement` extraction + duplicate-define guard into `fui:plugs/webregistries/CustomElementRegistry.ts`, **preserving FUI's `downgrade` + FUI import paths** (per #1270 principle 1 — audit, don't blind-copy). Update the FUI unit test. Independent, batchable. | — |
| **#1304 (core, re-sized) — declarative scoped registration + global patching** | story · 8 | Port `we:plugs/webregistries/ScopedRegistryAttribute.ts` + `we:plugs/webregistries/declarativeRegistry.ts` (#854/#900/#901) into `fui:plugs/webregistries/` + wire the index exports; port the #1100 global patching (`applyPatches`/`removePatches`/`isPatched`/`attachShadow` scoped-init) into `fui:plugs/webregistries/index.ts`; **fix the MOMENT-2 binding** so the ported `we:plugs/webregistries/__tests__/unit/declarativeRegistry.test.ts` binds (`bound=true`) in FUI's env. Internally entangled (the index patch imports `applyScopedRegistryToHost` from `declarativeRegistry`) → one focused story, not batch fodder. | — |

**DAG:** **DEC**, **A**, and **#1304-core** are **mutually independent** (DEC = cross-repo `core/`
contract; A = `we:plugs/webregistries/CustomElementRegistry.ts` preserving downgrade; core = the declarative/`we:plugs/webregistries/index.ts` files —
disjoint surfaces). A is immediately batchable; DEC is a decision to prepare/ratify; #1304-core is a
focused single-item session. Each leaves FUI building green: A adds the registry improvements, core adds
the declarative+patching layer, neither touches `downgrade`.

## Could not split

| Scope | Failed condition | Unblocking action |
|---|---|---|
| **Splitting #1304-core further** (declarative-files port vs MOMENT-2 binding fix vs index patching) | **(3)/(5)** — the `bound=false` binding fix is **investigation-gated** (the FUI-side cause is unknown until the files are ported and the failing test is run); splitting now would guess seams the work-investigation pass forbids, and a "port files only" slice leaves a red `we:plugs/webregistries/__tests__/unit/declarativeRegistry.test.ts` (no demoable state) | **Land #1304-core's port, run the failing binding test, diagnose the FUI MOMENT-2 cause first.** Re-`/split` the core afterward if the fix turns out to be large + separable. |

## Notes
- **Edge case applied:** #1304 already has `parent: 1250`, so it is **not** converted to an epic. It
  stays a `story`, **re-sized 13 → 8**, scope narrowed to the declarative/patching core, fork removed.
  DEC + A scaffold as **new siblings under #1250**.
- **The fork is cross-repo, not FUI-only.** The carried-forward body framed it as a "FUI-architecture
  decision"; grounding shows `we:plugs/core/Plug.ts`/`we:plugs/core/HTMLRegistry.ts`/`we:plugs/unplugged.ts` are byte-identical in both repos
  and **WE itself is red** — so DEC is a shared-`core/` decision that also fixes a live WE regression. My
  lean: **(A) drop the requirement** (~80%; native-first #1103 already ruled the polyfill mirrors native,
  and the shared contract is simply un-reconciled — keeping it re-litigates #1103). Residual: any plug
  that genuinely needs `Plug.downgrade(root)` for non-element plugs (the interface is generic over all
  plugs, not just `CustomElementRegistry`) — DEC must confirm no other registry relies on it.
- **DAG-honesty follow-up (noted, not over-wired):** the #1309 webregistries drift-gate can't go green
  for this domain until DEC's convergence lands (FUI-keeps vs WE-drops `downgrade` is a permanent
  `we:plugs/webregistries/CustomElementRegistry.ts` diff otherwise). On execution I'll add **A** to `#1309.blockedBy` (it's part
  of the reconcile); DEC's successor convergence should also gate #1309 — flagged for the decision turn.

## Net

3 slices from #1304 (1 stays as the resized original + 2 new siblings: 1 decision + 1 task). Proposed
mutation (gated on go): scaffold **DEC** (`type:decision`) + **A** (`task·3`) under #1250, resize #1304
`13 → 8` + narrow digest to the declarative/patching core, add **A** to `#1309.blockedBy`. #1250 child
count 19 → 21.

---

# `/split 1353` — FUI demo-host gate (2026-06-20)

**Candidate:** [#1353](/backlog/1353-fui-re-host-the-bootstrap-demo-consuming-pages-that-gate-the/) `story·13`, `locus: frontierui` — the FUI build gate #1245 stalls on. Its body bundles ~12 consuming demos whose WE block-runtime families can drop only once each is re-hosted FUI-side and embedded via the #701 `fuiDemo` iframe (the #1326 pattern). The body asserts the FUI equivalents "don't exist yet"; the work-investigation pass shows that is **per-family false** — several FUI impls are already complete, only the FUI-hosted *demo page* is missing.

## Work investigation — real import graph (not body text)

Each WE demo's runtime consumption (`grep` of `demos/*.ts` + bootstrap), and the FUI-side readiness of the family it needs:

| WE demo | WE family consumed | FUI impl state (`fui:blocks/…`) | Deliverable now? |
|---|---|---|---|
| `data-table-demo` | `renderers/data-table` | **complete** — `fui:renderDataTable.ts` + `fui:__fixtures__/data-table-cases.ts` | **yes** |
| `pagination-demo` | `renderers/pagination` | **complete** — `fui:renderPagination.ts` + `fui:__fixtures__/pagination-cases.ts` | **yes** |
| `wizard-flow-demo` | `wizard` + `workflow-engine` | **complete** — `fui:WizardElement.ts` (`registerWizard`) + `fui:workflowTypes.ts` (`WorkflowGraph`) | **yes** |
| `loader-background-handoff-demo` | `resource-loader` | **partial** — `fui:index.ts` exports `ResourceLoader` but **not `backgroundLoad`**; **no `__fixtures__`** (demo imports `reference-receiver`, `handoff-scenarios`) | no — FUI gap |
| `reorderable-list-demo` | `renderers/reorderable-list` | **partial** — missing `fui:renderCrossListReorder.ts` + **no `__fixtures__`** (demo imports `reorderable-list-cases`, `cross-list-reorder-cases`) | no — FUI gap |
| `component-adapter-demo` (+ `mockup-to-standard`, `module-as-a-service`, `code-upgrader`) | `renderers/component` | **absent** — no `fui:blocks/renderers/component/` | no — FUI gap |
| `declarative-spa`, `navigation-demo`, `for-each-demo`, `text-interpolation-demo`, `jsx-adapter-demo` (+6 more) | 7 bootstrap families (`router/navigation/parsers/text-nodes/for-each/transient/attributes`) **+ `stores`** | impls present FUI-side, but all 11 demos load the **single** importer `we:plugs/bootstrap.ts` | no — coupled bulk |

Importer check (clean independence for the 3 candidates): `renderers/data-table` ← only `we:demos/data-table-demo.ts`; `renderers/pagination` ← only `we:demos/pagination-demo.ts`; `wizard`/`workflow-engine` ← only `we:demos/wizard-flow-demo.{ts,html}` (+ an a11y sitemap-route test that the iframe swap preserves). No shared importer → deleting each family breaks only its own demo, which the swap re-homes.

## Could split — 3 clean slices (FUI impl complete, deliverable now)

Each slice = **build the FUI-hosted demo (impl already exists) → WE swaps `we:demos/<x>.html` to a #701 `fuiDemo` iframe → delete the WE runtime family + its demo `we:demos/*.{ts,css}`.** Exactly the #1326 (view+tabs) shape. All three are independent (no shared importer, no inter-slice edge) → **batchable in one `/batch`**.

| Slice | Scope | `size`/`workitem` | Deletes (WE) | DAG |
|---|---|---|---|---|
| **S1 — data-table** | host `fui:demos/data-table-demo.html` (self-bootstrap, template = existing `data-grid-demo`); swap `we:demos/data-table-demo.html`→iframe; delete `we:blocks/renderers/data-table/` + `we:demos/data-table-demo.{ts,css}` | `story·3` | `blocks/renderers/data-table` | parent #1353, no blocker |
| **S2 — pagination** | same shape for `pagination` | `story·3` | `blocks/renderers/pagination` | parent #1353, no blocker |
| **S3 — wizard-flow** | host `fui:demos/wizard-flow-demo.html` (combines existing `wizard-demo` + `workflow-engine-demo`); swap WE page→iframe; delete `we:blocks/{wizard,workflow-engine}/` + `we:demos/wizard-flow-demo.{ts,css}` | `story·3` | `blocks/wizard`, `blocks/workflow-engine` | parent #1353, no blocker |

DAG: `#1353 (epic) → {S1, S2, S3}` — three leaves, fully parallel.

## Could not split — gated on FUI build (no decision involved; re-`/slice` as each gap clears)

The embed-vs-modeC choice is a settled per-demo menu (`#we-fui-embed-boundary` rule 6), so **none of these is a decision card** — each is an FUI *impl* gap. They stay in #1353's body as the documented remainder.

| Scope | Failed condition | Unblocking action |
|---|---|---|
| **loader-background-handoff** (`resource-loader`) | **(2)/(5)** — FUI lacks `backgroundLoad` + the `reference-receiver`/`handoff-scenarios` fixtures; a slice now would build a FUI demo against a missing capability | FUI adds `backgroundLoad` to `resource-loader` + ports the 2 fixtures, then carve. |
| **reorderable-list** (`renderers/reorderable-list`) | **(2)/(5)** — FUI missing `fui:renderCrossListReorder.ts` + `__fixtures__` (`reorderable-list-cases`, `cross-list-reorder-cases`) | FUI builds the cross-list reorder renderer + fixtures, then carve. |
| **component-adapter** (`renderers/component`, consumed by 4 WE demos) | **(2)/(5)** — no `fui:blocks/renderers/component/` at all; wide consumer fan-out (mockup-to-standard, module-as-a-service, code-upgrader, component-adapter) | FUI builds the `component` declarative renderer (tied to the component-block gaps #1286/#1289), then carve per consuming demo. |
| **7 bootstrap families + `stores`** (`router/navigation/parsers/text-nodes/for-each/transient/attributes`) | **(3)/(4)** — not per-family sliceable: a single importer `we:plugs/bootstrap.ts` is shared by 11 bootstrap-loading demos; deleting any one family breaks all 11 at once | Re-host the 11 bootstrap demos FUI-side + relocate `we:plugs/bootstrap.ts` (the #606 move, dropped as stale — needs reopening), **then** bulk-delete the 7 families in one follow-up. This remainder is itself a future sub-epic. |

## Net

**3 slices** carved from #1353 (all new children); #1353 `story·13` → **storied epic** (drop `size`, umbrella digest), remainder documented in-body. Proposed mutation (gated on go): convert #1353 → epic; scaffold S1/S2/S3 as `story·3` under `--parent=1353` (no blocker edges); `check:standards` green; backlog count +3. The 3 slices are immediately batchable → `/batch`.


---

# Backlog split analysis — 2026-06-20 (focused: #1236)

`/split 1236` — single-item run. Candidate: **#1236 — Render the WE pitch deck (#1209 content) on
the FUI deck components + plateau hosting** (`workItem: story`, `size: 13`, `parent: 1210`,
`locus: plateau-app`, `relatedProject: webdocs` → oversized-story candidate kind **a**).

## Verdict: **could split** — three per-audience deck slices over one foundational integration shell

### Work-investigation pass

- **Content is ready, as data not code.** #1209 is resolved; its four child stories graduated to
  reports. The shared spine is `we:reports/2026-06-20-deck-narrative-spine.md` (B1–B7 proof-point
  library); the three audience decks are full slide-by-slide outlines, ~10 slides each:
  `we:reports/2026-06-20-deck-strategic-vision-outline.md`,
  `we:reports/2026-06-20-deck-developer-technical-outline.md`,
  `we:reports/2026-06-20-deck-design-system-adopter-outline.md`. Each is a *complete standalone deck*
  for its audience, all drawing the same B1–B7 spine — a clean per-audience seam, not one monolith.
- **Components are built and consumable.** `fui:blocks/deck/DeckBehavior.ts:46` exposes
  `class DeckBehavior(host, opts)` driving light-DOM `[data-slide]` children (doc-model #1180 +
  layout-template #1191 + advance #1179, with #1195 a11y owned in-behavior); re-exported from
  `fui:blocks/deck/index.ts`. No custom element — the host is driven directly.
- **Hosting surface does not exist.** `grep -rl deckbehavior plateau-app/src` → zero hits; no `/deck`
  route. The established page pattern is a `mountX(mount)` module themed by DTCG/webtheme CSS vars
  (`plateau:src/marketing/landing.ts:38` `mountLanding`) wired into a route loader
  (`plateau:src/main.ts:115`, mounted like `landing` at `plateau:src/main.ts:52`). The deck page is a
  net-new `plateau:src/marketing/deck*.ts` building `[data-slide]` markup + a `DeckBehavior` mount,
  themed via `we:webtheme/tokens.ts`, on a new `/deck` route.

So the real work = a foundational plateau integration shell (page module + `DeckBehavior` mount +
webtheme theming + route + browser-verify + green `../plateau-app` gate) **plus** three per-audience
slide-markup bodies. The shell is the bulk and the hard part; once it exists, each additional
audience deck is incremental slide markup + a route on the same shell.

### Rubric check (all five hold)

1. **Volume, not uncertainty** — no buried fork. #1215 confirmed all 19 deck contracts spec'd, the
   #765/#777 mount boundary relaxed, #1228 shipped the FUI build. Boundary policy, fit-to-viewport,
   a11y are all owned by `DeckBehavior`. Per-audience decking is *settled* by #1209's audience-targeted
   output, not an open call. ✓
2. **≥2 nameable slices, each with a real home** — foundational shell + strategic deck (A),
   developer deck (B), design-system deck (C); all homed `locus: plateau-app`, parented to #1210. ✓
3. **Slices land small** — A `size 5`, B `size 3`, C `size 3`; each names real files
   (`plateau:src/marketing/deck*.ts`, `plateau:src/main.ts` route, `fui:blocks/deck/index.ts` import,
   `we:webtheme/tokens.ts`) from the investigation. ✓
4. **Clean DAG with real independence** — A → {B, C}; B and C proceed **independently in parallel**
   once A lands (each just adds its own audience markup + route on the shared shell). ✓
5. **Every slice leaves a valid demoable state** — A ships a complete, themed, browser-verified
   strategic deck (a real demo); B and C each ship a complete additional audience deck. No
   half-rendered intermediate. ✓

### Proposed slices

| slice | NNN | kind / size | scope | blockedBy |
|---|---|---|---|---|
| A | **#1236** (re-sized in place) | story · 5 | Foundational plateau deck shell: `mountDeck` page module + `DeckBehavior` mount over `[data-slide]` markup + webtheme theming + new `/deck` route + browser-verify + green plateau gate. Renders the **strategic/vision** deck (`we:reports/2026-06-20-deck-strategic-vision-outline.md`) as the first audience. | — |
| B | new | story · 3 | **Developer/technical** deck: synthesize `we:reports/2026-06-20-deck-developer-technical-outline.md` into `[data-slide]` markup on the shell + its route. | #1236 |
| C | new | story · 3 | **Design-system/enterprise** deck: synthesize `we:reports/2026-06-20-deck-design-system-adopter-outline.md` into `[data-slide]` markup on the shell + its route. | #1236 |

**Edge case applied:** #1236 already has `parent: 1210`, so per the workflow doc it is **not** nested
into a new epic — it stays a re-sized `story` (5) carrying the core/foundational slice, and B/C are
added as **siblings under the same parent #1210**.

DAG: `#1236 → {B, C}`. After #1236, B and C are independently batchable in parallel. Net flow: **+2**
new stories; #1236 re-sized 13 → 5 (no story→epic conversion — it keeps its parent).
