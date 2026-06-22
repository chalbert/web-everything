---
kind: story
size: 5
parent: "1353"
status: resolved
locus: webeverything
blockedBy: []
relatedReport: reports/2026-06-22-backlog-split-analysis.md
dateOpened: "2026-06-20"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: "we:blocks/renderers/pagination/__fixtures__/pagination-goldens.ts"
tags: []
---

# WE pagination golden-vector conformance — redesign auditPagination into a stored-golden data-reader (per #1467/#899)

**Re-scoped from a `size:13` "verifier-redesign + demo-iframe + delete" lump — see `we:reports/2026-06-22-backlog-split-analysis.md` (Run 5).** The split (mirror of #1494's Run 4) kept **only** the clean, batchable-now WE-owned verifier work here; the demo-iframe-swap + WE-backend delete + live-FUI verify carved to its sibling slice. No coordinator slice (unlike data-table's #1521): `PageState` is a **type-only** import in `we:blocks/renderers/collection-operations/CollectionOperationsBehavior.ts:27` and stays in the WE contract plane.

Per ratified #1467(→b) under #899's vector-conformance split, WE keeps the **verifier + vector corpus + types** (incl. `PageState`, `we:blocks/renderers/pagination/renderPagination.ts:26`), and that verifier must assert the **stored golden output as data — no live render, no backend recompute**. Today every WE consumer feeds `auditPagination` (`we:blocks/renderers/pagination/renderPagination.ts:186`) a **live WE render** and the verifier recomputes via `rangeText(state)` (~line 224):

- `we:blocks/__tests__/unit/renderers/pagination.test.ts:13` value-imports `renderPagination, auditPagination, rangeText`.
- `we:blocks/__tests__/unit/renderers/pagination-behavior.test.ts:8-9` value-imports `auditPagination, announcePagination` + the `PaginationBehavior` runtime.
- `we:demos/pagination-demo.ts:11` value-imports `renderPagination, auditPagination`.

And the fixtures (`we:blocks/renderers/pagination/__fixtures__/pagination-cases.ts`) are **input-only (0 goldens)**. So this story:

- **Redesign `auditPagination` into a pure golden-reader** — assert a rendered root against a *stored* expected projection (nav landmark / aria-current / range slice / sentinel), with no live `renderPagination` and no `rangeText` recompute (the golden serialization is an impl detail of the capture step, not the assertion).
- **Generate + commit golden vectors** for the pagination corpus (capture rendered DOM as data → parse back → run `auditPagination` over the golden). Net-new mechanism; **share #1494's golden-vector serialization approach**.
- **Rework `we:blocks/__tests__/unit/renderers/pagination.test.ts` + `we:blocks/__tests__/unit/renderers/pagination-behavior.test.ts`** to stop value-importing the WE backend for recompute — assert against the goldens. This is the precondition that lets the sibling slice delete the WE `renderPagination` backend without stranding the tree.

Leaves a green demoable state: the WE backend still exists and the demo still renders; only the conformance source-of-truth flips to stored goldens.

---

## Historical pre-flight lineage (pre-split)

The notes below predate the Run 5 split and are retained for lineage; they are what drove the 8→13 re-size and the `/split` recommendation that this re-scope realizes.

### Original digest (pre-split)

Build fui:demos/pagination-demo.html self-bootstrapping the (complete) FUI pagination renderer; swap we:demos/pagination-demo.html to a #701 fuiDemo iframe; delete we:blocks/renderers/pagination + we:demos/pagination-demo.{ts,css}. #1326 pattern.

## Pre-flight note — unmet build precondition; re-sized 3 → 5 (batch-2026-06-20-1344-1342)

Same finding as sibling #1355: `fui:demos/pagination-demo.html` does **not** exist yet, so this bundles
building + browser-verifying a self-bootstrapping FUI demo (the #1312-analog the #1326 size-3 precedent had
as a *separate* prior item) with the delete+swap. Recommend splitting the demo build into its own prereq
and making this the delete+swap `blockedBy` it; needs a focused session with the FUI dev server for live
render verification before deleting the WE source.

## Re-scope from #1467 ruling (ratified 2026-06-21 → b)

Delete confirmed **but bounded by #899's vector-conformance split** — impl → FUI, not a clean wipe:

- **Leave in WE:** the pagination assertion-semantics **verifier** + the pagination vector corpus + the
  contract **types** (incl. `PageState`). WE conformance asserts the **stored golden output** (data).
- **Move to FUI:** the runnable pagination backend (`renderPagination` + its compute).
- **No coordinator-import precondition (unlike #1355):**
  `we:blocks/renderers/collection-operations/CollectionOperationsBehavior.ts` imports `PageState` from
  `../pagination/renderPagination` as a **type-only** import — types stay in WE, so no value re-home blocks
  this card. Keep the `PageState` type in the WE contract plane when the runtime renderer moves.

## Pre-flight (batch-2026-06-21-1429-1487) — one blocker cleared, but the #1467 re-scope outgrew it (5 → 8)

Grounded both trees. **Good news:** the original pre-flight blocker is gone — `fui:demos/pagination-demo.html`
**now exists**, and FUI has the complete renderer (`fui:blocks/renderers/pagination/` — `renderPagination`,
`PaginationBehavior`, fixtures, tests, demo). So the demo-build prereq the prior note called out is satisfied.

**But the #1467 re-scope (ratified 2026-06-21, above) turned the clean delete into a verifier-redesign — the
same #1494-class work — so it now outgrew story·5:**
- **WE still live-renders in conformance.** `we:blocks/__tests__/unit/renderers/pagination.test.ts` +
  `we:blocks/__tests__/unit/renderers/pagination-behavior.test.ts` + `we:demos/pagination-demo.ts` all
  **value-import the WE `renderPagination` backend**. The #1467 ruling requires WE to **assert the stored
  golden output as data (no live WE render)** and move the runnable backend → FUI.
- **No stored goldens.** `we:blocks/renderers/pagination/__fixtures__/pagination-cases.ts` cases are
  **input-only** (0 golden/expected); the golden-vector mechanism (capture rendered output as data, parse it
  back, run `auditPagination` on it) is **net-new** — exactly the #1494 finding. (`auditPagination` itself is
  a DOM-structural reader, which helps, but it still needs a golden DOM to read, not a live WE render.)
- **Plus this card's own extras on top:** swap `we:demos/pagination-demo.html` → a #701 `fuiDemo` iframe,
  delete `we:blocks/renderers/pagination` backend + `we:demos/pagination-demo.{ts,css}`, and **live-verify the
  FUI demo renders** (FUI dev server) before deleting the WE source.

So it is a focused-session **verifier-golden redesign + cross-repo backend move + iframe swap + delete +
live FUI render verification** — re-sized 5 → 8, carry-forward reason **outgrew**. Sibling of the data-table
pair (#1494 backend re-home, #1355 delete) under the same #1467/#899 split; they should share the
golden-vector approach. No new design fork (placement ruled by #1467). Released to `open`.

## Pre-flight (batch-2026-06-21-1501-1356) — re-confirmed not a concurrent-batch slice; co-design with #1494

Re-grounded; the prior outgrew finding holds. Two properties keep it out of a concurrent batch (matching #1494, which this batch also declined): (a) the **destructive delete** of `we:blocks/renderers/pagination` strands the WE conformance tests + `we:demos/pagination-demo.ts` (which value-import `renderPagination`) until the golden-verifier redesign AND the #701 iframe swap **co-land** — a green/unbroken tree is unreachable piecemeal; (b) the delete is gated on **live FUI-dev-server render verification** of `fui:demos/pagination-demo.html` (deleting the WE source unverified is reckless). It is a focused-session **verifier-golden redesign + cross-repo backend move + iframe swap + delete + live FUI verify**, and should be co-designed with the data-table golden-vector approach (#1494/#1355). Carry-forward reason: **outgrew / not-batchable** (verifier-golden redesign + live-verify-gated destructive delete). Left at size 8 (its real size is bounded but it is a focused session, not a concurrent slice); released to `open`.

## Pre-flight (batch-2026-06-22-1510-1483) — re-sized 8 → 13 (focused-session verifier-golden unit, recommend `/split` like #1494)

Third pre-flight confirms the prior two: this is the pagination sibling of the data-table `#1467/#899`
split, and the #1467 re-scope made it a **verifier-golden redesign + cross-repo backend move + #701 iframe
swap + delete + live FUI render verification** — not a clean batch slice. The WE conformance tests
(`we:blocks/__tests__/unit/renderers/pagination.test.ts` + `we:blocks/__tests__/unit/renderers/pagination-behavior.test.ts`) and
`we:demos/pagination-demo.ts` still **value-import the WE `renderPagination` backend`, and the
golden-vector mechanism (capture rendered output as data → parse → `auditPagination` over it) is **net-new**
(`we:blocks/renderers/pagination/__fixtures__/pagination-cases.ts` is input-only). Deleting the WE backend
strands those + the demo until the golden redesign **and** the #701 iframe swap co-land — the same
must-co-land shape as #1494/#1355, so a solo close can't be green.

The data-table sibling **#1494 was just `/split`** (concurrently this batch) into a clean **verifier-redesign
slice (size 5) + #1521 (coordinator) + #1355 (renderer delete)**. **Recommend the identical `/split` for
pagination:** (a) a batchable **verifier-golden redesign** slice (redesign the WE pagination conformance to
assert stored goldens as data — no live WE render — + generate/commit goldens, sharing #1494's golden-vector
approach), and (b) a **demo-iframe-swap + backend-delete** slice (#701 `fuiDemo` iframe for
`we:demos/pagination-demo.html`, delete `we:blocks/renderers/pagination` + `we:demos/pagination-demo.{ts,css}`,
live-verify the FUI demo first). Re-sized **8 → 13** (drops from the batch pool until split). Carry-forward
reason: **outgrew / not-batchable-as-one**. No new design fork (placement ruled by #1467). Released `open`.
