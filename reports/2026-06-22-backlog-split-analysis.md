# Backlog split analysis — 2026-06-22

Seven focused runs recorded today: **#1502** (below), **#1485** (appended), **#1234**, **#1494**, **#1356**, **#1460**, and **#1472** (at the end).

---

## Run 1 — `/split 1502`

Candidate: **#1502** — *Codification-hygiene sweep: re-point G7 backlog
citations from `#N` to their platform-decisions statute anchor* (`kind: story`, `size: 13`).

## Could split

_none._

## Could not split

| Candidate | Failing condition | Unblocking action |
|---|---|---|
| **#1502** (`size:13` story) | Rubric (4) **real independence**, under the conservative-instinct override (needless fragmentation, zero gain). Mechanically the work *partitions* (by statute anchor — see below — each cluster is independent, task-sized, no DAG edges, each leaves a valid demoable state where the G7 audit count drops). But the property that disqualified this item from batching is **whole-backlog concurrent-file contention** (it edits ~73 `backlog/*.md` files that other live sessions hold/edit) — a **scheduling** constraint, not a **volume** constraint. No decomposition removes it: every anchor-slice still sprays edits across many concurrent-held backlog files, so the slices are no more safely-batchable than the parent. `/split` exists to *feed* `/batch`; here it would emit fragments that each still demand a quiescent backlog and still can't run concurrently (with other sessions *or* with each other). Net = one coherent sweep fragmented into ~6 pieces that only make sense run sequentially in one quiescent session (= the original), plus 6× audit re-runs and 6 review seams. | **None via decomposition.** Run #1502 as-is as a single focused sweep when no concurrent backlog sessions are active (it was deliberately re-sized 5→13 to leave the batch pool for exactly this reason — see the item's pre-flight note). It is correctly sized and correctly *not* batchable. If one session ever wants to chunk the 73 internally, that's intra-session sequencing by anchor, not a backlog split. |

### Why the mechanical partition is real but irrelevant

For the record, the work *does* cluster cleanly by statute anchor (counts from the live G7 section of
`we:audits/backlog-health-audit.md`, ~73 citing items, several cite >1 anchor):

- `#monetization` — the bulk (e.g. #89, #97, #140, #142, #143, #181, #184, #186, #285, #297, #302, #314,
  #428, #554–#557, #563, #646, #660, #666, #1083, #1104, #1391, #1500, …)
- `#constellation-placement` — #99, #170, #291, #479, #561, #642, #699, #800, #820, #872, #907, #912,
  #967, #978, #999, #1030, #1234, #1353, #1355, #1356, #1494, …
- `#we-fui-embed-boundary` — #728, #764, #777, #818, #1234, #1504, …
- `#intents-ux-only` — #99, #140, #142, #315, #317, #318, #746, #777, …
- `#project-protocol-bar` — #142, #153 (→#2), #236, #237, #283, #315, #646, #1153, #1207, …
- `#no-leakage-client` — #490, #513, #514, #798, #890, #1073
- `#forward-generation-adapters` — #818, #939, #1258, #1451
- `#component-dc` — #232, #715, #928
- `#runtime-di-vs-devtools-provider-seam`, `#native-first-baseline`, `#behavior-activation-lifecycle`,
  `#config-extends-platform-default`, `#surface-contract-not-computation` — singletons / pairs

Each cluster satisfies rubric (1) (volume, decision already codified), (2) (≥2 nameable, real home in the
citing items' files), (3) (task-sized), (5) (valid demoable state — audit count monotonically drops). It
fails only on the independence-that-matters: the slices aren't independent of the concurrent-edit
contention that is the *whole reason* the parent left the batch pool. A partition that reproduces the
disqualifying property in every piece is a needless fragmentation, not a split.

## Net flow

`+0` — no mutation. Report-only; #1502 left as a `size:13` story.

---

## Run 2 — `/split 1485`

Candidate: **#1485** — *Realizing dockable block — recursive container + drag-to-dock +
serialization + popout* (`kind: story`, `size: 13`, `status: open`, `blockedBy: 1437✓, 1484✓`).

### Verdict: **CAN SPLIT** — 5 new slices + reuse existing #1486

#### Why it's safe (rubric — all five hold)

1. **Size is volume, not an unresolved decision.** Every fork is ratified in #1437 (resolved):
   Fork 1a (standalone intent), Fork 2a (layout-tree as a first-class Protocol), Fork 3a
   (`popout` default `none`). The dockable **intent** JSON already landed
   (`we:src/_data/intents/dockable.json`, via resolved #1484). What remains is net-new contract +
   impl **volume** for a golden-layout/dockview-class paradigm.
2. **≥2 nameable slices, each with a real home.** Contract → WE (`we:blocks/dockable/contract.ts`
   + `we:contracts/dockable.ts`); render / interaction / serialization / popout → FUI impl
   (`locus: frontierui`). Pattern verified against `we:contracts/stepper.ts` (type-only re-export
   of `we:blocks/<name>/contract`) + the `exports` map in `we:contracts/package.json`.
3. **Each slice lands `size` ≤ 3 / task.** A=2, B=3, C=3, D=2, E=3 (sum = 13, matches the re-size).
4. **Clean DAG, incremental delivery.** Contract (A) unblocks both the impl chain and the protocol;
   render (B) → {interaction (C), serialization (D)}; serialization realizes the conforming impl
   that lets the #1486 protocol be extracted.
5. **Every slice leaves a valid demoable state** (A is the foundational gate-verifiable contract
   exception; B–E each leave a runnable docking demo).

#### Proposed slices

| Slice | Title | locus | kind·size | blockedBy | demoable state |
|-------|-------|-------|-----------|-----------|----------------|
| **A** | WE dockable block contract — `we:blocks/dockable/contract.ts` + `we:contracts/dockable.ts` re-export + `we:contracts/package.json` export | WE | story·2 | — (deps #1437/#1484 resolved) | contract compiles; gate green; #1486 + FUI impl can import the node-tree types |
| **B** | FUI recursive container render — row/column/stack via CSS Grid/Flex + recursive `resizable` splits + APG Window Splitter a11y | FUI | story·3 | A | static partition-tree renders; dividers resize siblings (demo page) |
| **C** | FUI drag-to-dock — edge/center zone hit-testing + topology mutation (split a leaf into a new row/column/stack) + APG Tabs on stacks | FUI | story·3 | B | drag a panel → live re-tile (composes #1384 Pointer-Events + `moveBefore` + #1495 `pan`); **live-interactive** |
| **D** | FUI layout-tree serialize / restore — emit & rehydrate `{type,children\|tabs,size}` | FUI | story·2 | B | save → reload → identical layout round-trip; the conforming impl that validates the #1486 core schema |
| **E** | FUI `popout: window` — cross-document subtree relocation (`window.open()` + `adoptedStyleSheets`; deferred, highest-risk; breaks `moveBefore` + roving-tabindex) | FUI | story·3 | C | pop a stack into an OS window, still live |

**Reused (NOT a new slice):** #1486 — dockable layout-tree interchange Protocol — already exists as
the body-carve's slice 4. Action: **re-parent** under #1485 and **repoint** `blockedBy: ["1485"]`
→ `["<D>"]`. D is the realizing serialization impl that validates the core schema, honoring #1486's
own protocol-bar temporal rule ("extracted once a conforming impl validates the core schema").
Repointing to D (not the whole epic) keeps the blocker DAG honest.

#### DAG

```
            ┌──→ B ──┬──→ C ──→ E
A (contract)┤        └──→ D ──→ #1486 (existing, repointed)
```

#### Execution on approval

1. Convert **#1485** in place: `story` → storied **epic**, drop `size`, refresh digest to umbrella
   framing, keep `status: open`, keep the number.
2. Scaffold A, B, C, D, E with `--parent=1485` + the `--blocked-by` edges above; add
   `locus: frontierui` to B–E after scaffold (no `--locus` flag).
3. Re-parent #1486 (`--parent 1485`) + repoint its `blockedBy` to D.
4. Gate `npm run check:standards` green; confirm backlog count +5.

#### Could not split

None — #1485 splits cleanly.

### Net flow (run 2, on approval)

`+5` slices, #1485 story → epic, #1486 re-parented + repointed. Report-only until "go".

---

## Run 3 — `/split 1234`

Candidate: **#1234** — *Land the WE→`@frontierui/plugs` repoint for real* (`kind: story`, `size: 13`,
`status: open`).

### Verdict: **could not split** — `atomic`

## Could split

_none._

## Could not split

| Candidate | Failing condition | Unblocking action |
|---|---|---|
| **#1234** (`size:13` story) | Rubric **(5) every slice leaves a valid demoable state** (and consequently **(2)/(3)** — no slice is independently demoable at `size ≤ 3`). | **None via decomposition** — it is genuinely atomic. Run it as a single focused WE session that owns the dev-server lifecycle (already noted on the item). |

### Why #1234 is atomic — the investigation

The remaining work (from the item's 2026-06-22 pre-flight) is four points, all landing in **one file**
(`we:vite.config.mts`) against **one live-only acceptance** (26 demos + 5 test-pages still rendering):

1. Replicate FUI's ~26-entry `@webeverything/*` alias block into `we:vite.config.mts`.
2. Re-apply the `/plugs`→FUI prefix alias + 8 sub-aliases + the 5 test-page `../plugs/`→`/plugs/` rewrites.
3. Iteratively live-verify the full 26-demo/test-page surface until **0 transitive 500s**.
4. Handle the bare `@webeverything/{contracts,plugs,conformance-vectors}` specifiers FUI plugs import.

I read the real tree to test whether a seam falls anywhere here:

- **The alias-block addition (point 1) is a no-op in isolation.** Verified: none of the 26 entries
  (`capability-manifest`, `validation-generation/*`, `contracts/*`, `commitment-policy`, `error-summary`,
  `interaction-state`, `webcases/requirementValidator`) exist in `we:vite.config.mts:165-185` today
  (vs. `fui:vite.config.mts:215-245`), and **no WE-side runtime/demo/test-page imports any of them** (the
  lone `@webeverything/webstates` hit in `we:demos/webmanifests-conformance-demo.ts:28` is a string literal,
  not an import). They go live *only* the instant the `/plugs`→FUI repoint (point 2) makes FUI plugs the
  served source, because the FUI plugs transitively re-export from that graph. Landing point 1 alone
  produces nothing demoable to verify — fails "independently-deliverable".

- **The repoint (point 2) without the full alias graph (point 1) breaks the surface.** Proven across the
  item's three pre-flights: a partial repoint 500s (`Failed to resolve import @webeverything/capability-manifest`)
  and "silently blanks the demo surface" — an invalid demoable state. Each prior attempt was *fully reverted*
  for exactly this reason.

- **The transitive tail (points 3/4) is discovered, not pre-partitioned.** Acceptance is "iterate until
  0 transitive 500s across 26 pages." The alias set actually needed is found *by running the live loop*;
  you can't draw `file:line`-citable slice boundaries ahead of a closure you only learn by executing it.

There is also no per-demo seam: the repoint is **one** prefix alias (`/plugs`→FUI), not a per-demo edit —
you can't "repoint half the demos." The 5 test-page rewrites are per-file but trivial and inert until the
alias lands.

**Conclusion:** alias graph + repoint + iterative live-verify are one coupled config edit. Any partition
yields either a no-op non-deliverable (point 1 alone) or an invalid demoable state (point 2 before 1), and
the transitive tail can't be sliced in advance. Volume bound to a single live-verify loop, not separable.
Recorded as `unsplittableReason: atomic` on the item.

**No new fork** is buried here — the design direction (contract-anchored, FUI-as-superset) is resolved
(#1250), so this is not an `undecided`/decision-card case.

### Net flow (run 3)

`+0` — no mutation. Report-only; #1234 left as a `size:13` story, `unsplittableReason: atomic` recorded.

---

## Run 4 — `/split 1494`

Candidate: **#1494** — *Re-home CollectionOperationsBehavior + data-table backend semantics to FUI
(per #1467/#899); WE keeps verifier + vectors + types* (`kind: story`, `size: 13`, `status: open`,
`parent: 1353`, `blockedBy: []`).

### Verdict: **CAN SPLIT** — 2 batchable-now slices (parent edge-case: keep #1494 + 1 sibling)

#### The investigation overturned the body's "must-co-land 13" framing

Three prior pre-flights re-sized this 5→8→13 and ruled it a "must-co-land-with-#1355" unit because
"deleting the WE backend strands `we:demos/data-table-demo.ts`, and #701 forbids repointing it to FUI
block code." Reading the real tree shows that conclusion conflated **three** distinct pieces, only one
of which is the entangled delete:

1. **Verifier redesign (WE-keeps).** `auditDataTable` (`we:blocks/renderers/data-table/renderDataTable.ts:390`)
   today **live-recomputes** the expected result via `applyPipeline`/`cellDisplayText`/`summaryText`
   (lines 393, 427, 438). The #1467/#899 ruling needs it to assert a **stored golden as data, no
   recompute**. The fixtures (`we:blocks/renderers/data-table/__fixtures__/data-table-cases.ts`) are
   **input-only** (rows + config; the "golden" is computed live) — so goldens must be generated +
   committed and the verifier rewritten to read them. This work is **additive** — it touches only the
   verifier + fixtures + the WE test, leaves the renderer/backend/demo intact, and is **independent of
   any delete**.
2. **Coordinator re-home (WE-sheds, independent).** `we:blocks/renderers/collection-operations/CollectionOperationsBehavior.ts`
   value-imports `applyPipeline, aggregate` (line 24-25). Investigation of its consumers: **nothing in WE
   imports it except its own test** (`we:blocks/__tests__/unit/renderers/collection-operations.test.ts`).
   The `collection-operations` references in `we:demos/pagination-demo.html:28` + `we:demos/data-table-demo.html:28`
   are `<a href="/intents/collection-operations/">` **doc links, not imports**; `registerCollectionOperations`
   (line 241) is never called outside its test. FUI already hosts the coordinator
   (`fui:blocks/renderers/collection-operations/`). So deleting WE's copy + its test is **fully
   self-contained and green today** — it removes a renderer *consumer*, breaks nothing, needs no #1355 co-land.
3. **Backend/renderer delete (= #1355's job, double-counted here).** "Delete `we:blocks/renderers/data-table`
   backend + demo" is **already #1355's stated scope** (`#1355` title: *"…delete we:blocks/renderers/data-table"*,
   `blockedBy: 1494`). This is the only piece that strands the demo, and #1355 already carries the #701
   FUI-iframe swap that fixes the strand. #1494 re-stating it was the conflation that forced the size-13
   must-co-land framing.

Separating (1) and (2) out as clean slices and recognizing (3) belongs to #1355 **dissolves the
must-co-land deadlock**: #1494 (verifier) and the new sibling (coordinator) become clean prerequisites;
#1355 stays the single convergence point where the strand-creating delete + its iframe fix live together.

#### Why it's safe (rubric — all five hold)

1. **Volume, not uncertainty.** No open fork — #899 vector model + #1467 placement (→b) are ratified; the
   golden serialization format is an impl detail, not a decision.
2. **≥2 nameable slices, real home.** Both WE-owned: the verifier (WE keeps it) and the coordinator
   cleanup (WE sheds its copy). `file:line`-grounded above.
3. **Slices land ≤5 / task.** Verifier slice = 5 (golden-format design + generate 8 goldens + rewrite
   verifier + rewrite one test); coordinator slice = 2 (delete one file + its test). Sum 7 < 13 — the
   residual 6 was the #1355-double-counted delete.
4. **Clean DAG, real independence.** **Both slices are `blockedBy: []` and proceed independently** —
   the strongest form of condition (4). #1355 converges on both.
5. **Every slice leaves a valid demoable state.** Verifier slice is additive (demo intact + new
   golden-backed conformance green). Coordinator slice deletes an unconsumed headless behavior (FUI hosts
   the demo'd version) — WE green, demo unaffected.

#### Proposed slices

| Slice | Title | locus | kind·size | blockedBy | demoable state |
|-------|-------|-------|-----------|-----------|----------------|
| **#1494** (kept, re-scoped, 13→5) | WE data-table golden-vector conformance — redesign `auditDataTable` → stored-golden data-reader; generate + commit per-case goldens; rewrite `we:blocks/__tests__/unit/renderers/data-table.test.ts` (no live WE render) | WE | story·5 | — | additive; data-table demo intact + new golden-backed WE conformance green |
| **#NEW** (sibling under #1353) | Delete the WE `CollectionOperationsBehavior` coordinator + its WE test — FUI already hosts it; only WE consumer is its own test | WE | story·2 | — | WE green; demos unaffected (only doc-link refs to it remain) |

#### DAG

```
#1494 (verifier→golden) ──┐
                          ├──→ #1355 (build done; #701 iframe swap + delete renderer + demo)
#NEW  (delete coordinator)┘
```

Re-point **#1355 blockedBy → [1494, #NEW]**: its renderer delete must follow (a) the verifier no longer
recomputing via `applyPipeline` — #1494, and (b) the WE coordinator (a renderer consumer) being gone —
#NEW (else deleting the renderer strands the coordinator's import → red tree). No cycle; both prereqs are
`blockedBy: []`.

#### Execution on approval (parent edge-case — #1494 already has `parent: 1353`)

1. **#1494 stays a `story`** (do **not** convert to epic — it has a parent): re-size `13 → 5`, refresh
   title/digest to the verifier-only scope, keep `status: open`, keep the number.
2. Scaffold **#NEW** (`--workitem=story --size=2 --parent=1353`, `blockedBy: []`) with a real digest;
   add `locus: webeverything` if scaffold defaults otherwise.
3. Repoint **#1355** `blockedBy: ["1494"]` → `["1494","<NEW>"]`.
4. Gate `npm run check:standards` green; confirm backlog count **+1** (#NEW; #1494 is re-scoped in place).

#### Could not split

The backend/renderer delete is not a #1494 slice — it is **#1355's existing scope** (would duplicate its
`we:blocks/renderers/data-table` delete). No #1494 residual is left unhomed.

### Net flow (run 4, on approval)

`+1` slice (#NEW), #1494 re-scoped story 13→5, #1355 `blockedBy` repointed. Report-only until "go".

---

## Run 5 — `/split 1356`

**Candidate:** #1356 (`story`, `size: 13`, `parent: 1353`) — "FUI-host pagination renderer demo, swap WE
page to #701 iframe, delete `we:blocks/renderers/pagination`." The pagination sibling of the data-table
`#1467/#899` split; its three pre-flights converge on the *same shape Run 4 split #1494 into*, and the
body explicitly recommends the identical `/split`.

### Work investigation (grounded against the real tree)

- **The verifier already reads structure, but conformance still live-renders.**
  `auditPagination` (`we:blocks/renderers/pagination/renderPagination.ts:186`) is a DOM-structural reader
  (queries `nav`/`aria-current`/`.pagination-range`), but it still recomputes via `rangeText(state)`
  (line ~224), and every WE consumer feeds it a **live** WE render:
  - `we:blocks/__tests__/unit/renderers/pagination.test.ts:13` value-imports `renderPagination,
    auditPagination, rangeText`.
  - `we:blocks/__tests__/unit/renderers/pagination-behavior.test.ts:8-9` value-imports `auditPagination,
    announcePagination` + `PaginationBehavior` runtime.
  - `we:demos/pagination-demo.ts:11` value-imports `renderPagination, auditPagination`.
- **No stored goldens.** `we:blocks/renderers/pagination/__fixtures__/pagination-cases.ts` is **input-only
  (0 `expected`/`golden`)** — the golden-vector mechanism (capture rendered DOM as data → parse → run
  `auditPagination` over the golden DOM, no live WE render) is **net-new**. Identical to the #1494 finding.
- **No coordinator slice needed (unlike data-table).**
  `we:blocks/renderers/collection-operations/CollectionOperationsBehavior.ts:27` imports `PageState`
  **type-only** from `../pagination/renderPagination`; `PageState` is declared at `we:renderPagination.ts:26`
  and **stays in WE** (contract plane). So pagination has *no* `#1521`-analog coordinator delete — the WE
  backend that moves is the runnable renderer/compute only.
- FUI already hosts the complete renderer (`fui:blocks/renderers/pagination/` — `renderPagination`,
  `PaginationBehavior`, fixtures, tests, `fui:index.ts`) and `fui:demos/pagination-demo.html` exists.

### Could split — proposed slices (mirror of Run 4's #1494/#1355, minus the coordinator slice)

| Slice | workItem / size | Scope | blockedBy | Batchable |
|---|---|---|---|---|
| **A — WE pagination golden-vector verifier redesign** | story / **5** | Redesign WE pagination conformance to assert a **stored golden DOM as data** — capture rendered output as a serialized vector, parse it back, run `auditPagination` over the *golden* (no live `renderPagination`, no `rangeText` recompute); generate + commit goldens (today's `we:pagination-cases.ts` is input-only); rework `we:pagination.test.ts` + `we:pagination-behavior.test.ts` to stop value-importing the backend for recompute. Keep `PageState` type + verifier + vector corpus in WE. Shares #1494's golden-vector serialization approach. | `[]` | **yes** |
| **B — FUI pagination demo iframe swap + WE backend delete + live verify** | story / **5** | Swap `we:demos/pagination-demo.html` → a #701 `fuiDemo` iframe; **live-verify `fui:demos/pagination-demo.html` renders** on the FUI dev server *first*; then delete `we:blocks/renderers/pagination` runnable backend (`renderPagination` + compute) + `we:demos/pagination-demo.{ts,css}`. | `["A"]` | after A |

**DAG:** A → B. B `blockedBy` A because deleting the WE `renderPagination` backend strands the conformance
tests + demo until A removes their value-import/recompute dependence. Clean linear chain, no cycle.

**Rubric:** (1) size is volume not an undecided fork — placement ruled by #1467(→b), no open decision; (2)
two nameable slices, each with a real home (WE verifier plane / cross-repo demo+delete); (3) each lands a
single-pass story ≤5 (mirrors the just-approved #1494=5 / #1355=5 precedent); (4) clean A→B DAG with real
incremental delivery (A batchable now, B unblocks on A); (5) every slice leaves a green demoable state —
after A the backend still exists and the demo still works; after B the demo is a verified FUI iframe.

### Could not split

Nothing residual. Unlike data-table there is **no coordinator-delete slice** (PageState is type-only, kept
in WE; #1521 already covers the shared `CollectionOperationsBehavior` delete). The backend delete is folded
into slice B (it strands nothing once A lands), matching #1355's role for data-table.

### Net flow (run 5, on approval)

`+2` slices (A, B), #1356 converted `story:13` → **storied epic** (edge case: it has `parent: 1353`, so per
the skill it stays a re-sized container — see execution note below). Report-only until "go".

#### Execution on approval (parent edge-case — #1356 already has `parent: 1353`)

Same shape as Run 4's #1494 handling: #1356 **already has `parent: 1353`**, so do **not** convert it to an
epic (no nesting). Instead keep #1356 as a `story`, **re-scope it in place to slice A** (the
batchable-now verifier-golden redesign): re-size `13 → 5`, refresh title/digest to the verifier-only scope,
keep `status: open`, keep the number, set `relatedReport`. Then scaffold **slice B** as a sibling under
`parent: 1353`, `blockedBy: ["1356"]`, `locus: webeverything` where applicable. Gate `npm run
check:standards` green; backlog count **+1** (B; #1356 re-scoped in place). This yields the same #1494
verifier-slice + #1355 delete-slice topology, sized 5 + 5.

---

## Run 6 — `/split 1460`

**Candidate:** #1460 (`kind: story`, `size: 13`, `status: open`, `blockedBy: ["1419"✓]`) — "Realize the
query (server-state) intent: UX-only intent JSON + swappable cache provider contract + FUI resource-cache
block + demo." The read-path symmetric sibling of the #1395 mutation intent. Its 2026-06-22 pre-flight
already recommends routing to `/new-standard` with a 3-slice decomposition; this run validates that against
the real tree and refines the foundational piece into **two** parallel slices.

### Work investigation (grounded against the real tree)

- **The design is fully ruled — volume, not a decision.** #1419 (`we:backlog/1419-server-state-query-cache-lifecycle-fetch-dedupe-cache-stalen.md:5`) is **resolved**: mint a first-class `query` intent (not extend loader), cache rides a **swappable runtime-DI provider** behind `key → {data, staleness, revalidate}`, and the red-team amendment narrowed the **intent surface to UX-only** (`fetchPolicy` + staleness display composing loader) while the technical knobs (dedupe, freshWindow/evictAfter, revalidateOn, dependsOn) ride the provider contract. **No residual open fork** — rubric (1) clears.
- **The intent JSON is a clean foundational artifact.** `we:src/_data/intents/mutation.json` (the symmetric sibling) is a 48-line file: `id`/`name`/`status`/`summary`/`dimensions`/`description`(embedded HTML)/`events`. `we:src/_data/intents/query.json` does not exist yet; the loader (`we:src/_data/intents.js:13`) auto-globs `src/_data/intents/*.json` — **no registry index** and **no `*-descriptions/*.njk` companion** (description embeds in-file). So the intent slice is one self-registering file.
- **The provider contract is net-new and must be its own foundational slice.** Verified there is **no** `blocks/mutation*/contract.ts` — #1395 shipped *only* the intent (`graduatedTo: none`), because mutation is pure UX. Query is different: it carries a real provider contract. The established pattern is `we:blocks/NAME/contract.ts` + a type-only re-export `we:contracts/<x>.ts` (`export type * from '../blocks/<x>/contract'`) wired into the `exports` map in `we:contracts/package.json` (16 entries today; no `resource-cache`). Per the codified rule the `*/contract.ts` is **always its own foundational slice** — the FUI impl can't import `@webeverything/contracts/resource-cache` until it lands.
- **The FUI block has a real extend point.** `we:blocks/resource-loader/` exists (full block); the #1419 ruling names the impl as "a `resource-cache` block / a `resource-loader` extension" (cross-repo, `locus: frontierui`). No WE impl — WE holds zero implementation.

### Refinement of the body's 3-slice seed → 4 slices

The pre-flight bundled `we:query.json` + the provider contract into one foundational slice. Two reasons to
carve them apart: (a) the codified rule that a `*/contract.ts` + `@webeverything/contracts/*` re-export is
**always its own foundational slice**; (b) #1419's own amendment **decouples** the UX-only intent surface
from the technical provider contract — they are different files, different planes (`src/_data` intent vs
`blocks/`+`contracts/` type artifact), with no edge between them. Splitting them strengthens rubric (4):
two foundational slices proceed **in parallel** rather than as one lump.

### Could split — proposed slices

| Slice | kind·size | locus | Scope | blockedBy | Batchable |
|---|---|---|---|---|---|
| **A — `query` intent JSON** | story·2 | WE | Author `we:src/_data/intents/query.json` (UX-only surface — `fetchPolicy`: cache-first / network-only / cache-and-network + staleness display composing `loader`), mirroring the 48-line `we:src/_data/intents/mutation.json` shape; transcribable from #1419. Self-registers via the glob loader. | `[]` | **yes (now)** |
| **B — resource-cache provider contract** | story·3 | WE | Author `we:blocks/resource-cache/contract.ts` (the `key → {data, staleness, revalidate}` provider + the technical knobs: dedupe, freshWindow/evictAfter ms, revalidateOn, dependsOn) + the type-only `we:contracts/resource-cache.ts` re-export + the `exports` entry in `we:contracts/package.json`. Net-new (no #1395 mirror). | `[]` | **yes (now)** |
| **C — FUI resource-cache block** | story·5 | FUI | Implement the contract as a `resource-cache` block (or `resource-loader` extension): keyed cache, staleness, revalidate, invalidate-on-mutation. Imports `@webeverything/contracts/resource-cache`. | `["B"]` | after B |
| **D — demo** | story·3 | FUI | Keyed-cache demo with staleness display + invalidate-on-mutation, live-verified on the FUI dev server. | `["C"]` | after C |

**DAG:**

```
A (query.json) ────────────────────────┐  (parallel, both blockedBy [])
B (provider contract) ──→ C (FUI block) ──→ D (demo)
```

A and B are independent foundational slices (rubric (4) strongest form — ≥2 proceed in parallel); C
realizes the contract; D demos. The intent (A) and the provider (B/C) converge only in the demo (D), which
exercises `fetchPolicy` over a keyed cache.

**Rubric — all five hold:** (1) volume, not a fork — #1419 fully ruled, no residual decision; (2) four
nameable slices each with a real home (WE intent plane / WE contract plane / FUI impl / FUI demo);
(3) each re-estimates ≤5 (A=2, B=3, C=5, D=3; sum 13, matches the re-size); (4) clean acyclic DAG with two
genuinely independent foundational slices **plus** incremental delivery; (5) every slice leaves a valid
state — A renders on `/intents/`, B is a gate-verifiable type-only contract (the foundational-definition
exception, WE holds zero impl), C ships a conforming FUI block, D is the fixture-driven demo.

### Could not split

Nothing residual. The body's "route to `/new-standard`" recommendation is satisfied by this decomposition:
the prior-art survey already lives at the `server-state-cache-lifecycle` research topic (cited by #1419),
so `/split` produces exactly the slice DAG `/new-standard` would, with no un-investigable piece deferred.

### Execution on approval (no parent — standard story→epic conversion)

1. Convert **#1460** in place: `story` → storied **epic**, **drop `size: 13`**, refresh digest to umbrella
   framing ("Umbrella for realizing the query intent; sliced into #A/#B/#C/#D"), keep `status: open`, keep
   the number, set its `relatedReport` to this report.
2. Scaffold A, B (`--parent=1460`, `blockedBy: []`), C (`--parent=1460 --blocked-by=<B>`, add
   `locus: frontierui` post-scaffold), D (`--parent=1460 --blocked-by=<C>`, `locus: frontierui`), each with
   a real digest.
3. Gate `npm run check:standards` green; confirm backlog count **+4**.

### Net flow (run 6, on approval)

`+4` slices (A, B, C, D), #1460 `story:13` → storied epic. Report-only until "go".

---

## Run 7 — `/split 1472`

**Candidate:** #1472 (`kind: story`, `size: 13`, `status: open`, `blockedBy: ["1471"✓]`) — "annotation
intent + FUI behavior block + demo — UX over the durable-range-anchor contract." The realizing build of
#1408 Fork 2 (UX half), sibling shape to Run 6's #1460. Its 2026-06-22 pre-flight recommends routing to
`/new-standard` with a 3-slice decomposition; this run validates that against the real tree.

### Work investigation (grounded against the real tree)

- **The design is fully ruled — volume, not a decision.** #1408 (`we:backlog/1408-content-annotation-highlight-comment-on-selection-standard-p.md`) is **resolved**: Fork 2 split the realizing build into a UX-only annotation intent (this item) vs. the durable-range-anchor contract (#1471). **No residual open fork** — rubric (1) clears (the item's own pre-flight confirms "No new design fork").
- **The blocker is resolved and the composed contract exists.** #1471 (`we:backlog/1471-durable-range-anchor-contract-range-w3c-selector-serialize-r.md`) is **resolved** (`graduatedTo: we:range-anchor/contract.ts`); the contract file exists at `we:range-anchor/contract.ts`. So the anchor contract the intent composes is importable today — slice A has no live blocker.
- **The intent JSON is a clean foundational artifact.** `we:src/_data/intents/annotation.json` **does not exist yet** (net-new). The loader auto-globs `src/_data/intents/*.json` (~80 siblings, e.g. `we:src/_data/intents/anchor.json`, a structured `id`/`name`/`requiresCapabilities`/`status`/`summary`/`dimensions` file) — **no registry index** to edit, so the intent slice is one self-registering file. UX-only per #1408: select content → attach a motivation payload (`highlighting|commenting|tagging|suggestion`) + overlay disposition; composes the #1471 anchor contract + `selection` / `rich-text` / `anchor` / highlight-api intents. Owns no anchor machinery.
- **The FUI behavior block has a real home, no WE impl.** FUI hosts behavior blocks under `fui:plugs/webbehaviors` + `fui:blocks/`; there is **no** `range-anchor` realization in FUI yet (the contract just landed). WE holds zero implementation, so the realizing behavior block is cross-repo (`locus: frontierui`). This is the substantial slice — it composes the #1471 contract and realizes the 4 motivations + overlay disposition + in-model mark (when editable) + orphaned-annotation as a first-class outcome.
- **The demo is a leaf, live-verified on FUI.** "Highlight + comment over read-only HTML," live-verify on the FUI dev server — a fixture-driven demo exercising the behavior block.

### Could split — proposed slices (validates the body's 3-slice seed)

| Slice | kind·size | locus | Scope | blockedBy | Batchable |
|---|---|---|---|---|---|
| **A — `annotation` intent JSON** | story·3 | WE | Author `we:src/_data/intents/annotation.json` (UX-only: select → motivation payload `highlighting\|commenting\|tagging\|suggestion` + overlay disposition; **composes** the #1471 `we:range-anchor/contract.ts` + `selection`/`rich-text`/`anchor`/highlight-api; owns no anchor machinery), mirroring the `we:src/_data/intents/anchor.json` shape. Self-registers via the glob loader. Orphaned-annotation is a first-class outcome. | `[]` | **yes (now)** |
| **B — FUI annotation behavior block** | story·5 | FUI | Realize the intent as a FUI behavior block: compose `we:range-anchor/contract.ts`, attach/render the 4 motivations + overlay disposition, in-model mark when editable, anchor+popover surface, highlight-api path, orphaned-annotation handling. Imports the anchor contract. | `["A"]` | after A |
| **C — demo (highlight + comment over read-only HTML)** | story·3 | FUI | Fixture-driven demo: select text in read-only HTML → highlight + attach a comment; live-verify on the FUI dev server. | `["B"]` | after C→B |

### DAG

```
A (annotation.json) ──→ B (FUI behavior block) ──→ C (demo)
```

A is independently batchable now (composes the resolved #1471 contract — no live blocker) and ships valid standalone (renders on `/intents/`). The chain is linear, but **incremental delivery is genuinely valuable** (rubric (4)): A is a self-contained WE standard artifact; B a conforming FUI realization; C the demo — each leaves a valid state on its own.

**Rubric — all five hold:** (1) volume, not a fork — #1408 fully ruled the UX-only split, no residual decision; (2) three nameable slices each with a real home (WE intent plane / FUI behavior block / FUI demo); (3) each re-estimates ≤5 (A=3, B=5, C=3; sum 11 ≤ the 13 re-size, with headroom); (4) clean acyclic DAG — A batchable now + incremental delivery down the chain; (5) every slice leaves a valid demoable state — A renders on `/intents/`, B ships a conforming behavior block (own tests), C is the fixture-driven demo.

### Could not split

Nothing residual. The body's "route to `/new-standard`" recommendation is satisfied by this decomposition — the prior-art survey folds into authoring slice A (no blocking design pass), so `/split` produces exactly the slice DAG `/new-standard` would, with no un-investigable piece deferred. (Same shape as Run 6's #1460, minus the separate provider-contract slice — annotation composes an *existing* contract, so there is no net-new `*/contract.ts` foundational slice here.)

### Execution on approval (no parent — standard story→epic conversion)

1. Convert **#1472** in place: `story` → storied **epic**, **drop `size: 13`**, refresh digest to umbrella framing ("Umbrella for realizing the annotation intent; sliced into #A/#B/#C"), keep `status: open`, keep the number, drop the now-redundant `blockedBy: ["1471"]` (resolved), set its `relatedReport` to this report.
2. Scaffold A (`--parent=1472`, `blockedBy: []`), B (`--parent=1472 --blocked-by=<A>`, add `locus: frontierui` post-scaffold), C (`--parent=1472 --blocked-by=<B>`, `locus: frontierui`), each with a real digest.
3. Gate `npm run check:standards` green; confirm backlog count **+3**.

### Net flow (run 7, on approval)

`+3` slices (A, B, C), #1472 `story:13` → storied epic. Report-only until "go".
