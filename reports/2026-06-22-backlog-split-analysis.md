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

---

## Run 8 — `/split all` (full-set sweep, 2026-06-22 PM)

Re-swept the complete candidate set. Of the 6 oversized stories + 4 unsliced epics live now, runs 1/2/6
above already covered **#1502 / #1485 / #1460**; this run covers the rest (#1207, #1483, #1548 + the four
epics) and flags an execution gap on #1460/#1485.

### ⚠ #1460 & #1485 — slices exist, parent conversion never completed (burndown double-count)

The splits proposed in **run 6 (#1460)** and **run 2 (#1485)** were executed — the child slices exist and
most are resolved:

- **#1460** children: #1532 (intent, resolved·2), #1533 (contract, resolved·3), #1534 (FUI block,
  resolved·5), #1535 (demo, **open**·3).
- **#1485** children: #1510 (contract, resolved·2), #1511 (render, resolved·3), #1512 (drag-to-dock,
  resolved·3), #1513 (serialize, resolved·2), #1514 (popout, **open**·3).

But **both parents are still `kind: story` with `size: 13` intact** — execution step 1 (convert
story→epic, drop `size`) was skipped. The burndown now **double-counts** each (13 on the parent *plus*
13 across the children = 26). It slips `check:standards` only because the sized-epic-with-sized-child
error fires on `epic`, not `story`. **No new slices needed** — the fix is purely the deferred conversion:
`kind: story` → storied `epic`, **drop `size: 13`**, refresh digest to umbrella framing. Each then becomes
a normal sliced epic with one open child (#1535 / #1514).

### Could split — #1483, #1548 (genuine new splits)

#### #1483 — webregistries plugged-mode root-scope determination (`locus: frontierui`)

Verified against the real tree: `fui:plugs/webregistries/CustomElementRegistry.ts` (284 lines) — `define()`
registers real-class-under-private-tag + empty-stand-in-under-real-tag; `upgrade()` (line ~166) delegates
to the native upgrade so it never swaps a root-parsed element's prototype. `fui:plugs/webregistries/index.ts:95`
has the root `redefine(window, 'customElements', …)` **commented out** (mitigation in place). The body's
own 2-way carve holds.

| Slice | kind·size | locus | Scope | blockedBy | Batchable |
|---|---|---|---|---|---|
| **A — root-scope determination impl + unit test** | story·5 | FUI | Implement a root-scope determination path: when the scoped registry is the **root**, `define(name, RealClass)` finds already-parsed root-document `name` elements and upgrades them (prototype swap + re-run the constructor-set state + `connectedCallback`), mirroring the native upgrade reaction. Unit test: define an autonomous element **after** its tag is already parsed in the body (the case #1387's suite misses). Byte-replicate to `we:plugs/webregistries/CustomElementRegistry.ts`. Bounded, gate-verifiable, **no live re-enable**. | `[]` | **yes (now)** |
| **B — re-enable swap + live multi-app verify** | story·5 | FUI | Uncomment the root `window.customElements` swap (`fui:plugs/webregistries/index.ts:95`); live-verify plateau-app + WE site + FUI demos render with **no `*-is-not-a-function` upgrade crash**. Focused frontierui session **owning the dev-server lifecycle** — re-enabling the very swap that white-paged plateau cannot run safely against the user's live :3000/:4000. | `["A"]` | **no** (owned-server live re-enable) |

**DAG:** A → B. Incremental: **A ships valid** (determination path + test land; swap stays disabled — zero
risk to live apps); B layers the high-stakes re-enable on the now-proven impl. **Rubric — all five:**
(1) volume, regression + fix shape specified, no fork; (2) two nameable FUI slices; (3) A=5 batchable, B=5;
(4) clean A→B with incremental delivery (A is independently useful + gate-verifiable); (5) A leaves a valid
state (impl tested, swap off), B the re-enabled valid state.

#### #1548 — plateau page: explorer run management (`locus: plateau-app`)

Verified: `fui:tools/explorer/cli.ts` (engine) exists; plateau's `plateau:src/design-review/`,
`plateau:src/vision-review/`, `plateau:src/control-plane/` confirm the page + `/api/*`-middleware pattern
the slices reuse. (Body cites "#1522 resolved" — #1522 is still **open**, but the CLI artifact it depends
on exists, so the dependency holds in fact; no `blockedBy` on #1548.) The body's own A/B/C carve is the
investigated seam.

| Slice | kind·size | locus | Scope | blockedBy | Batchable |
|---|---|---|---|---|---|
| **A — bundle store + executor endpoint** | story·8 | plateau | Plateau dev-server middleware (mirrors the `/api/*` mock layer) shelling to `fui:tools/explorer/cli.ts -- <url> --auth <recipe> --out <dir>`, tracking status; persist + index + serve per-run bundles. De-risking foundation. *(Itself a future `/slice` candidate — executor vs store.)* | `[]` | yes (after re-slice) |
| **B — history viewer (read-only)** | story·5 | plateau | A plateau page listing past runs and rendering a selected bundle (report + screenshots) inline. Dogfoods FUI components. Demoable on its own — no trigger. | `["A"]` | after A |
| **C — trigger + recipe editor** | story·8 | plateau | Launch a run from the page, edit/save recipes (base URL, auth steps, routes, viewports), live status. *(Future `/slice` candidate.)* | `["A","B"]` | after B |

**DAG:** A → B → C. **Incremental delivery is the explicit v1** (A+B browse existing bundles, before C
trigger/manage), so the executor is proven read-path-first. **Rubric:** (1) volume, placement ruled, no
fork; (2) three nameable plateau slices; (3) B=5 batchable now; **A=8 and C=8 re-estimate honestly** — each
becomes its own `/slice` candidate, but the 21→8+5+8 decomposition still manufactures one immediately-
batchable slice (B) on a clean DAG (the rubric-(3) "≤5" bar is met by B; A/C are flagged for recursion,
not papered over); (4) clean acyclic chain with genuine incremental value; (5) each leaves a valid demoable
state (A headless-testable, B read-only demo, C full surface).

### Could not split

| # | title | rubric condition failed | unblocking action |
|---|---|---|---|
| **1207** | `{{ }}` interpolation renders path not value | **(1) uncertainty, not volume / (2) no ≥2 seams.** Open-ended live-debugging spike — 4× carried `outgrew`, no proven fix, scope unknown until the in-module `customTextNodes.upgrade()` is instrumented on a cold start. One investigation, no clean seam; the two acceptance items (find+fix the eval bug → real-browser regression test) can't be ordered until the cause is found. | Run as the focused FUI/demo debugging session it routes to. **Set `unsplittableReason: atomic`.** The side-finding (the demo's relative-import 500 — the deleted `we:plugs/bootstrap.ts`) is a **separate spin-off card**, not a slice of this story. |
| **1502** | G7 codification-hygiene sweep | **(2) no nameable seam / (5) no valid intermediate** (already analyzed in Run 1). One coherent mechanical sweep over ~73 files verified by a single audit re-run; anchor-clusters partition mechanically but every cluster reproduces the disqualifying whole-backlog concurrent-file contention — a scheduling constraint, not a seam. | Run as a focused single-session quiescent sweep. **Set `unsplittableReason: atomic`** (Run 1 left this unrecorded, so the deterministic split badge is still showing — clear it). |
| **237** | Inter-module comms as Protocols over the app model | **(1) buried design forks + foundational gate.** Body holds 3 open forks (protocol-vs-adapter rule classes; dependency-direction layering; component containment) **and** needs the introspectable app model (#140-class) that doesn't exist yet → un-investigable. | (a) Land #140-class introspectable runtime model; (b) carve the 3 forks into their own `kind: decision` item (de-bury), epic `blockedBy` it. *(Already `parent:150` — no nesting on a future split.)* |
| **555** | Collaborative deployed-patch preview (hosted) | **Foundational gate.** All 6 collaboration features are served from the #554 hosted SaaS shell, which is **parked** — no host surface exists. | Un-park + land #554, then carve the 6 features as `parent:555` stories (shareable preview link first). |
| **1294** | Relocate WE-resident logic reference runtimes to FUI | **Foundational gate (parked).** No `fui:webpolicy/` home, no headless-FUI surface path, #899 vector-runner unbuilt — slicing now strands conformance proof. | Meet un-park conditions (FUI hosts each runtime **and** website surfaces FUI headless **or** #899 ships), then slice per subsystem (webpolicy first). |
| **1391** | Dev-browser shell (Chromium, #141 successor) | **Foundational + funding gate.** Gated behind #140's funnel triage; per #141 the extension/DevTools-panel MVP must prove the model first. The chrome-shell surface (`plateau:src/dev-browser/`) doesn't exist. | Land #140 triage + file/ship the extension-MVP as the leading build; advance the shell only once that proves the model or a chrome-only capability demands it. |

### Run 8 net (on approval)

- **#1460, #1485** — finish the deferred conversion: `story` → storied `epic`, **drop `size: 13`** (slices
  already exist; clears the double-count). `+0` slices.
- **#1483** — `story` → epic, drop size; scaffold A·5 + B·5(←A). `+2`.
- **#1548** — `story` → epic, drop size; scaffold A·8 + B·5(←A) + C·8(←A,B). `+3`.
- **#1207, #1502** — set `unsplittableReason: atomic` (clears the split badge; no slices).
- **#237, #555, #1294, #1391** — report-only (foundational/design-gated; unblocking actions are upstream).

Total on approval: **+5 slices**, 4 story→epic conversions (#1460/#1485 finish-conversion, #1483/#1548
fresh), 2 atomic flags.

---

## Run 9 — `/slice 1585`

Candidate: **#1585** — *Design-knowledge intake program — a standing watch that distills
best-practice/usability research into the codified rubric* (`kind: epic`, **no children** → unsliced).

This is a **standing program** (review-program pattern), not a finite epic. The watch itself is
never-done, but its **L0→L1 bootstrap** is finite and sliceable — exactly the carve that the keystone
program **#1257** (platform-standards watch) ran when it spun off **#1267** (front-A metric, a clean
`size:3` task) while leaving its front-B sweep + cadence as body carves. #1585 follows the same shape.

The body names **two tracks**: (1) **source discovery & curation** — standardize the *admission +
credibility-weight criteria* (open-design posture: peer-reviewed usability research outranks a trend
blog), not a frozen source list; (2) **content distillation** — distill curated, weighted sources into
the #1034 design-critique rubric as codified heuristics carrying provenance (AI-over-a-contract; never
raw text into weights — the #490 distillation pipeline). Mapping these to the program's two fronts:
**front A (conformance)** = "is every admitted source distilled into the rubric?"; **front B
(currency)** = "new authoritative design knowledge appeared → admit, weight, file a distillation item."

## Could split

Two clean, build-ready, independent **task** slices fall out of the L0→L1 bootstrap:

| Slice | Kind / size | Home | Independence |
|---|---|---|---|
| **A (#1586) — Corpus ledger + front-A conformance metric** | `task` | `we:src/_data/designKnowledgeWatch.json` + `we:scripts/check-standards-rules.mjs` (+ test) + the epic's first review-log run | **Root** — exact #1267 analog. One row per admitted source `{ id, source, kind (peer-reviewed/standard/guideline/book/blog), credibilityWeight, distilledInto, trackingItem }`, seeded with the obvious authoritative set (Nielsen heuristics, Apple HIG, W3C/APG, UICrit/UIST'24…) at provisional equal weight; `computeDesignKnowledgeConformance()` → `{ total, distilled, pending, pendingList }` wired as a **nudge** (not error) into the gate. Ships before any criteria land (weights provisional, refined once **C** ratifies — same as #1267 shipping `registered:false` rows). |
| **B (#1587) — Rubric provenance schema** | `task` | `we:docs/agent/vision-tiers.md` §Design-critique rubric + the axis-vocabulary config | **Root** — the rubric is already "config + versioned, not frozen constants" (#1034 Fork 3 escape hatch). Add a `provenance` field to each of the 8 axes (and the open-findings contract) linking to admitted-source ids, populated from the axes' already-named groundings; **version-bump** the rubric. Schema-only — independent of **C**'s weighting and of **A**. Demoable: rubric shows provenance per axis. |

**DAG:** `A` ∥ `B` (both root, no edges) → **both batchable immediately**. `C` and `D` (below) are
parallel decision/blocked work, not edges into A/B.

```
A #1586 ── (root, build-ready)
B #1587 ── (root, build-ready)        A ∥ B  → batch now
C #1588 ── kind:decision (root, human-gated)
D #1589 ── blockedBy: #1588, #490
```

## Could not split

| Slice | Failing condition | Disposition / unblocking action |
|---|---|---|
| **C (#1588) — Source admission + credibility-weight criteria** | **(1) buries its own fork.** The body explicitly flags this as *open research* ("WHERE authoritative design knowledge comes from is itself open research"). What admits a source + how credibility weight is computed + how the open-design posture is preserved (custom sources must coexist) is a genuine fork — not volume. Forcing it into a `task` would bury the decision. | **File as a `kind:decision` child** (the fork's correct home, per *no slice may bury its own fork*). `blockedBy: []` — it can be prepared/ratified in parallel. Feeds A's `credibilityWeight` column + B's provenance weighting. |
| **D (#1589) — Distillation pipeline (codified heuristics w/ provenance, per #490)** | **(4) not independently deliverable + exceeds `size 3`.** "distill curated, weighted sources … #490 distillation pipeline" depends on **C** (weighted sources) *and* the #490 distillation *format* (how raw text → codified heuristics without leakage), which is itself an open epic. | **Carve as a blocked `story` (`size:5`)**, `blockedBy: C` + #490. Unblocking action: ratify **C** and land #490's distillation contract; then D's mechanism becomes a `task`-sized carve. |

### Adjacent real-state fix

#1585 declares itself a *standing program* in its body but the frontmatter lacks **`ongoing: true`**
(every other program — #1257, #1258 — carries it). Fold the flag in at scaffold time so watch-mode
(open epic, zero open children between deltas) reads correctly.

### Run 9 net (landed 2026-06-22)

- **#1585** — added `ongoing: true` (real-state fix); stays `kind: epic` (storied in place, no conversion).
- Scaffolded **#1586** (`task`, root) + **#1587** (`task`, root) — both batchable now.
- Filed **#1588** (`kind:decision`, root) — the admission/credibility-weight fork (de-buried).
- Carved **#1589** (`story`/5, `blockedBy: #1588, #490`) — distillation pipeline.
- `+4` children (2 task + 1 decision + 1 blocked story); `+2` immediately batchable.
fresh), 2 atomic flags.

---

## Run 10 — #1576 (focused `/slice`) — relocate the explorer conformance engine

**Candidate:** #1576 `story/13` ("Relocate the explorer conformance engine — interface → WE, runner/judge
impl → Plateau"). Re-pointed by #1566. Grounded the real surface across both repos:
`fui:tools/explorer/oracles/conformanceVectors.ts` (190 LOC — `ConformanceBinding` interface @ line 40,
`runConformanceVector`, `judgeConformanceTrace`, `ConformanceVectorOracle`) + `fui:tools/explorer/oracles/virtualClock.ts` (98 LOC).
The vector **schema + corpus are already WE-owned** (`we:conformance-vectors/`, `@webeverything/conformance-vectors/schema`).
Concrete binding: `fui:blocks/deck/deckConformance.ts` (one target). All slice paths are `file:line`-citable.

### Could split

| Slice | Kind / size | Home | Scope (grounded) | Independence |
|---|---|---|---|---|
| **(a) #1596** — Move `ConformanceBinding` interface FUI→WE | `story` / **3** | WE + FUI re-point | `ConformanceBinding` + `ConformanceBindingFactory` (`fui:.../conformanceVectors.ts:40-57`) → new `we:conformance-vectors/binding.ts` (`@webeverything/conformance-vectors/binding`, next to the already-WE schema); re-point importers (`fui:tools/explorer/oracles/conformanceVectors.ts:23`, `fui:blocks/deck/deckConformance.ts:15`, `fui:tools/explorer/oracles/index.ts:39` + test). Type-only, no fork. | **Root — batchable now.** FUI keeps working (interface sourced from WE), deck conformance test passes. |
| **(b) #1597** — Move runner/judge/clock impl FUI→Plateau | `story` / **5** | plateau-app | `runConformanceVector` + `judgeConformanceTrace` + `ConformanceVectorOracle` + `VectorSample`/`VectorTrace` (`fui:tools/explorer/oracles/conformanceVectors.ts:59-190`) + `VirtualClock` (`fui:tools/explorer/oracles/virtualClock.ts`) → Plateau (neutral runner, #427/#1577); re-wire `fui:tools/explorer/oracles/index.ts:38-50` Layer-2 export per #1595. | `blockedBy` #1596 (interface in WE) + #1595 (interim wiring). |

**DAG** — (a) root/batchable; (b) follows the interface move *and* the wiring ruling:
```
(a) #1596 ──┐ root, batch now
(D) #1595 ──┤ kind:decision, root (human-gated)
(b) #1597 ──┘ blockedBy: #1596, #1595
```
**Re-point:** #1355 + #1531 (`blockedBy 1576`) → **#1597** (the slice that lands the Plateau conformance home).

### Could not split (carved, not buried)

| Item | Failing condition | Disposition |
|---|---|---|
| **#1595** — interim FUI explorer Layer-2 wiring | **(1) buries a fork.** Once the runner/judge moves to Plateau but the explorer is still FUI-resident (#1577 `blockedBy` #1576), FUI explore-mode's semantic-conformance findings have no neutral source. (i) drop FUI Layer-2 `ConformanceVectorOracle` to an internal unit test [default] vs (ii) thin FUI shim calling the Plateau run (risks the WE→FUI→plateau-app backward edge). Real product-behavior call (#608) — not volume. | **Filed `kind:decision`** (`parent: 1576`), blocks #1597. #1576's inline fork de-buried → pointer to #1595. |

### Run 10 net (landed 2026-06-22)

- **#1576** — `story/13` → storied **epic** (size dropped, umbrella digest, inline fork de-buried → #1595).
- Scaffolded **#1596** (`story/3`, root — batchable now) + **#1597** (`story/5`, `blockedBy: #1596, #1595`).
- Filed **#1595** (`kind:decision`, the interim-wiring fork — de-buried).
- Re-pointed **#1355** + **#1531** `blockedBy: 1576 → 1597`.
- `+3` children (2 story + 1 decision); `+1` immediately batchable (#1596); #1576 story → epic.

---

## Run 11 — `/slice 866` — migrate WE-docs page-level UI to FUI components

**Candidate:** #866 `Migrate WE-docs page-level UI to FUI components (tiles/tables/badges/code-frame)` —
`kind: story`, `size: 13`, `parent: 777`, no children. Re-sized 5→13 by its 2026-06-22 pre-flight, which
explicitly recommends `/slice` **by surface type**. This run validates that against the real tree.

### Work investigation (grounded against the real tree, 2026-06-22)

- **No build blocker — it's volume.** All four #904 FUI blocks exist and export the mode-C mount
  (`../frontierui/blocks/{badge,card,code-view}` + `blocks/renderers/data-table`), and the #865 inline-mount
  precedent is landed (`we:src/_data/chrome.js` → `@frontierui/embed/chrome-in-document`). #864 theme bundle
  + #924 code-view are resolved.
- **The surfaces are hand-authored inline — there is no single shared macro to migrate.** `grep` over
  `src/**/*.njk`: badge ~**25** files, `<table>` ~**225**, `<pre>`/code-frame ~**71**, catalog tile/card
  ~**77** hits (~20 distinct catalog pages). Tables are scattered across per-page `.njk` + hundreds of
  `_includes/{block,research}-descriptions/*.njk` with bespoke `<table>` each — so cost scales with surface
  count; one macro-swap won't collapse it.
- **No buried fork.** The one residual (literal `tile` vs `card`) is already resolved in the body: tile maps
  onto `card`; a distinct tile would be a *new* FUI component, out of scope. Each slice is a mechanical
  migration of one surface to its #904 block.

### Verdict: **partial split** — surface-type is the safe first cut; only badges lands ≤3

Convert #866 `story` → storied **epic**, 4 surface-type children. Rubric:

1. **Volume, not a fork** ✓ — mechanical migration; no slice buries a fork (tile/card resolved).
2. **≥2 nameable slices, real home** ✓ — 4 surface types, each homed in `we:src/*.njk`/`_includes/`,
   dogfooding a distinct #904 block.
3. **Each slice lands `size` ≤ 3 / task** — **partial.** Only **badges (~25)** lands ≤3. Cards/code/tables
   exceed it and themselves need a second-level `/slice` (see could-not).
4. **Clean DAG, real independence / incremental delivery** ✓ — surfaces touch disjoint markup (no file
   conflict); sequenced badges-first so the inline mode-C transform is proven once, not reinvented 4×.
5. **Every slice leaves a valid demoable state** ✓ — each migrates one surface across the docs; the other
   three render unchanged; gate `npm run verify` + a :8080 render check.

### Could split — proposed slices

| Slice | Surface | FUI block dogfooded | Files | kind·size | blockedBy |
|-------|---------|---------------------|-------|-----------|-----------|
| **A — badges** | `badge` markup | `blocks/badge` | ~25 | story·**3** | — |
| **B — catalog tiles/cards** | tiles/cards (intents/blocks/design-systems + `project-*` includes) | `blocks/card` | ~77 hits / ~20 pages | story·5 | A |
| **C — code-sample/code-frame** | `<pre>` / code-frame | `blocks/code-view` (#924) | ~71 | story·8 | A |
| **D — tables** | `<table>` / data-table | `blocks/renderers/data-table` | ~225 | story·13 | A |

```
        A (badges, ≤3 — proves the inline mode-C mount transform)
        │
   ┌────┼────┐
   B    C    D     (disjoint surfaces; sequenced after A to reuse the proven pattern)
```

- **A (badges)** is the natural first slice: smallest, and it establishes the inline mode-C mount pattern
  (the docs analogue of #865's chrome mount) that B/C/D then replay mechanically.
- The `blockedBy: A` edges encode **pattern-precedence** (incremental delivery) — not a hard data/code dep
  (the surfaces are disjoint markup) — so four agents don't each invent a different inline-mount spelling
  and cost quality.

### Could not split (fully to ≤3) — and the unblocking action

**B, C, D do not yet land ≤3** (condition 3). They remain genuine stories because their surface volume is
large and the per-include-family boundaries aren't worth pre-carving before the transform is proven:

- **Failed condition:** (3) each slice lands `size` ≤ 3 / task.
- **Unblocking action:** land **A (badges)** to prove the inline `<surface>` → mode-C FUI mount transform
  on the :8080 docs build, then `/slice` each of **C** and **D** (and **B** if still >3) **by include-family**
  (`block-descriptions/` vs `research-descriptions/` vs `project-*` includes vs top-level pages) — each
  family is ~≤3 files-of-a-kind and demoable on its own. Carving that 2nd axis *before* badges proves the
  transform is premature decomposition (~10–15 speculative leaves, fuzzy card/code boundaries).

### Execution on approval (no parent conversion edge-case — #866 has `parent: 777`)

#866 already has `parent: 777`. Two readings of the skill's "convert story → storied epic": (a) a *story
with sized children* is the double-count gate's blind spot ([[project_split_parent_unconverted_double_count]]),
so #866 must become a `kind: epic` (drop `size: 13`) once it has sized children — nesting under #777 is
fine (#777 is itself an epic). I'll convert #866 → storied **epic**, drop `size`, keep `parent: 777`.

1. Convert **#866** `story` → storied **epic**, **drop `size: 13`**, refresh digest to umbrella framing
   ("Umbrella for migrating WE-docs page-level UI to FUI; sliced by surface type into #A/#B/#C/#D"), keep
   `status: open`, keep `parent: 777`, set `relatedReport` to this report.
2. Scaffold A·3 (no `--blocked-by`), B·5(←A), C·8(←A), D·13(←A) with `--parent=866` + real digests; each
   `locus: webeverything` (docs surface) where scaffold defaults otherwise.
3. Gate `npm run check:standards` green; confirm backlog count **+4**.

Only **A** is immediately batchable; **B/C/D** are the next slice/build targets (C/D themselves carry a
second-level `/slice` once A proves the transform).

### Run 11 net (on approval)

`+4` children (A·3 batchable now + B·5 + C·8 + D·13, all ←A), #866 `story:13` → storied epic. Report-only
until "go".
