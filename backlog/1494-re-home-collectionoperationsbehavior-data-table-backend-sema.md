---
kind: story
size: 5
parent: "1353"
status: resolved
blockedBy: []
relatedReport: reports/2026-06-22-backlog-split-analysis.md
dateOpened: "2026-06-21"
dateStarted: "2026-06-22"
dateResolved: "2026-06-22"
graduatedTo: "we:blocks/renderers/data-table/__fixtures__/data-table-goldens.ts"
tags: []
---

# WE data-table golden-vector conformance — redesign auditDataTable into a stored-golden data-reader (per #1467/#899)

**Re-scoped from a `size:13` "re-home + delete" lump — see `we:reports/2026-06-22-backlog-split-analysis.md`
(Run 4).** The split found the original conflated three pieces; this story keeps **only** the clean,
batchable-now WE-owned verifier work. The coordinator delete carved to **#1521**; the backend/renderer
delete was always **#1355's** scope (it strands the demo + carries the #701 iframe fix).

Per ratified #1467 (→ b) under #899's vector-conformance split, WE keeps the **verifier + vectors +
types**, and that verifier must assert the **stored golden output as data — no live render, no backend
recompute**. Today `auditDataTable` (`we:blocks/renderers/data-table/renderDataTable.ts:390`) *re-runs the
backend* — it calls `applyPipeline` (line 393), `cellDisplayText` (line 427), and `summaryText` (line 438)
to recompute the expected result, then compares the DOM. And the fixtures
(`we:blocks/renderers/data-table/__fixtures__/data-table-cases.ts`) are **input-only** (rows + config; the
golden is computed live). So this story:

- **Redesign `auditDataTable` into a pure golden-reader** — assert a rendered root against a *stored*
  expected projection (row order / aria-sort / group summaries / announce), with no call into
  `applyPipeline`/`cellDisplayText`/`summaryText` (the golden serialization format is an impl detail, not
  a fork).
- **Generate + commit per-case goldens** for the 8 fixtures (the #899 vector model — net-new, currently absent).
- **Rewrite `we:blocks/__tests__/unit/renderers/data-table.test.ts`** to assert the golden as data — green
  without rendering via a WE `renderDataTable`.

**Additive — leaves the WE renderer/backend + the data-table demo intact and green** (their delete is
#1355's). This is the prereq that lets #1355 delete the renderer without breaking the WE conformance gate:
once the verifier stops recomputing, `applyPipeline` & co. can leave WE.

## Acceptance

- `auditDataTable` no longer calls `applyPipeline`/`cellDisplayText`/`summaryText` — it reads committed goldens.
- Per-case goldens exist + are committed for every `we:blocks/renderers/data-table/__fixtures__/data-table-cases.ts` case.
- `we:blocks/__tests__/unit/renderers/data-table.test.ts` asserts the golden output as data, green without a live WE render.
- `npm run check:standards` green; the data-table demo + remaining WE backend untouched.

## History (pre-split)

The original scope ("re-home CollectionOperationsBehavior + delete the data-table backend to FUI") went
through three pre-flights (5→8→13, "must co-land with #1355"). The `/split 1494` investigation
(`we:reports/2026-06-22-backlog-split-analysis.md`, Run 4) showed the size-13 framing came from
double-counting #1355's renderer delete inside this item. Carving the coordinator to #1521 and returning
the renderer delete to #1355 leaves this story as the clean verifier-redesign slice (re-sized 13→5,
`blockedBy []`, batchable now).
