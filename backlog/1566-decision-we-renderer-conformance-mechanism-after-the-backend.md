---
kind: decision
status: open
locus: webeverything
dateOpened: "2026-06-22"
tags: [conformance, renderers, data-table, pagination, "1467", "899"]
---

# DECISION: WE renderer-conformance mechanism after the backend delete (data-table/pagination)

#1467 ratified that when a runnable renderer (data-table #1355, pagination #1531) moves WE→FUI, WE keeps the **verifier + vector corpus + types** and the suite "asserts the stored golden output as data, no live WE render". But the *mechanism* isn't specified, and grounding the delete surfaces two unresolved problems that block #1355/#1531: WE's `auditDataTable(root, golden)` needs a **rendered root** (produced by the renderer being deleted), and the verifier has **diverged** (FUI has `auditDataTable(table, rows, config)`; WE has `auditDataTable(root, golden)`). Decide how WE asserts goldens without the renderer, and which verifier is canonical, before the bounded delete can land.

## Why this blocks #1355 / #1531

`we:blocks/renderers/data-table/renderDataTable.ts` co-locates the **runnable backend**
(`renderDataTable` / `applyPipeline` / `aggregate` / `cellDisplayText` / `summaryText` / sort-state) **and**
the **verifier** `auditDataTable(root, golden)` (#1467 says the latter stays in WE). The WE conformance test
`we:blocks/__tests__/unit/renderers/data-table.test.ts` renders a root **via the backend** in all three
sections — the golden-as-data audit (it renders a root, then `auditDataTable(root, golden)`), the
**golden-drift guard** (`committed goldens == fresh capture from the reference renderer`), and the
interactive sort-toggle axis. Deleting `renderDataTable` from WE breaks every one of them: WE then has **no
way to produce a root** to feed `auditDataTable`, and **no renderer** to re-capture for the drift guard.

Compounding it, the verifier **diverged** during the FUI port (#1382): FUI's
`fui:blocks/renderers/data-table/__tests__/*` import `auditDataTable(table, rows, config)` (re-derives
expectations from rows+config), whereas WE's is `auditDataTable(root, golden)` (asserts a stored projection).
The "#1467 WE keeps THE verifier that FUI consumes" model is therefore **not realized** — there are two,
with different signatures.

## The fork (options — not yet researched/ratified)

- **A — Stored-root fixture.** Capture each case's rendered DOM once as an HTML-string fixture (alongside
  `we:blocks/renderers/data-table/__fixtures__/data-table-goldens.json`); WE's suite parses it and runs
  `auditDataTable(parsedRoot, golden)` — a true "no live render" assertion. Cost: a second frozen artifact
  + its own drift question.
- **B — Golden-JSON structural validation only.** WE drops the root-audit; the suite validates the goldens
  JSON is well-formed and matches the cases. The *behavioral* audit (root vs golden) lives only in FUI.
  Cheapest, but WE no longer verifies the projection semantics.
- **C — Reconcile on one verifier.** Make FUI's tests consume WE's `auditDataTable(root, golden)` (FUI
  renders, imports the WE verifier per the #872 contract-distribution model), retiring FUI's
  rows+config variant. WE's own suite still needs a root source (→ folds into A or B).
- **D — Move `auditDataTable` to FUI too.** Treat the whole conformance (render + audit + drift) as impl,
  contradicting #1467's "leave the verifier in WE" — would re-open #1467.

Plus the sub-question: **where does the golden-drift guard live** once the renderer is FUI-only (it needs the
renderer to re-capture — so it moves to FUI, but FUI's tests don't currently assert the golden JSON).

## Blocks

- #1355 (data-table backend delete + iframe swap) — `blockedBy` this.
- #1531 (pagination backend delete + iframe swap) — mirrors this golden shape
  (`we:blocks/renderers/data-table/__fixtures__/data-table-goldens.ts` header: "#1356 mirrors this golden
  shape"); `blockedBy` this.

Surfaced 2026-06-22 (batch-2026-06-22-1545-1549) grounding #1355: the demo-build + FUI renderer move + the
collection-operations precondition are all already done, so the *only* residual is this bounded delete —
which can't land without choosing the mechanism above. No design call was forced to keep it batchable.
