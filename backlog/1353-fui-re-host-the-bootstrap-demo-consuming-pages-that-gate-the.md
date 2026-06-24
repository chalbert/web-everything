---
kind: epic
status: open
locus: frontierui
dateOpened: "2026-06-20"
blockedBy: [1765, 1766, 1767, 1768]
childlessReason: blocked
tags: [frontierui, demos, dogfood, fui-build-gate]
---

# FUI re-host the bootstrap + demo-consuming pages that gate the remaining WE block-runtime deletes (#1245)

Umbrella for the FUI demo-host gate #1245 stalls on: the remaining WE block-runtime families can drop only once their consuming demos are re-hosted FUI-side and embedded via the #701 `fuiDemo` iframe (the #1326 pattern — build the FUI demo, swap the WE page to an iframe, delete the WE family). Sliced per-demo as each FUI impl is ready.

## Carved — FUI impl complete, deliverable now (`/slice 1353`, 2026-06-20)

Investigation of the real runtime import graph (not the body's framing) found three families whose FUI impl is already complete — only the FUI-hosted demo page is missing. Full analysis: `we:reports/2026-06-20-backlog-split-analysis.md` (§"`/split 1353`").

- **S1 — data-table** — delete `we:blocks/renderers/data-table` once `fui:demos/data-table-demo.html` hosts it (FUI renderer + fixtures complete).
- **S2 — pagination** — same shape (FUI renderer + fixtures complete).
- **S3 — wizard-flow** — delete `we:blocks/{wizard,workflow-engine}` once `fui:demos/wizard-flow-demo.html` hosts the combined demo (FUI `WizardElement`+`workflow-engine` complete).

All three are independent (no shared importer) → batchable together.

## Remainder — gated on FUI build (`blockedBy`; re-`/slice` as each gap clears)

`/slice 1353` on 2026-06-24 (`we:reports/2026-06-24-backlog-split-analysis.md`) confirmed **none** of these FUI impls has landed since 2026-06-20 — none is carvable into a deliverable re-host slice yet. No decision is involved (embed-vs-modeC is a settled per-demo menu, `#we-fui-embed-boundary` rule 6) — each is an FUI *impl* gap, now filed as its own open FUI-build item this epic is `blockedBy`:

- **#1765** — reorderable-list cross-list twin: FUI is within-list only; needs the `renderCrossListReorder` twin + fixtures ported into `fui:blocks/renderers/reorderable-list/`.
- **#1766** — loader-background-handoff: FUI `fui:blocks/resource-loader/` lacks `backgroundLoad` + handoff; port `we:blocks/resource-loader/backgroundHandoff.ts` + `we:blocks/resource-loader/handoffContract.ts` + fixtures.
- **#1767** — component renderer: no `fui:blocks/renderers/component/` dir exists (cited #1286/#1289 resolved but delivered other blocks — false edge); 4 WE consumer demos.
- **#1768** — bootstrap-bundle sub-epic: 7 families + `stores` share the single importer `we:plugs/bootstrap.ts` (11 demos); not per-family sliceable — re-host all 11 + relocate the plug, then bulk-delete.

When a prerequisite resolves, re-`/slice 1353` to carve that family's re-host slice and clear its `blockedBy` edge (drop `childlessReason: blocked` once the last edge clears).
