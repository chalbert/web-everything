---
kind: story
size: 8
parent: "1353"
status: open
blockedBy: []
dateOpened: "2026-06-20"
dateStarted: "2026-06-22"
tags: []
---

# FUI-host pagination renderer demo, swap WE page to #701 iframe, delete we:blocks/renderers/pagination

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
