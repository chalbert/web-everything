---
kind: epic
status: resolved
locus: frontierui
dateOpened: "2026-06-20"
dateResolved: "2026-06-27"
graduatedTo: none
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

## Remainder — carved as open child slices (`/slice 1353` + re-scope, 2026-06-24)

`we:reports/2026-06-24-backlog-split-analysis.md` (§§ "#1353", "#1768") carved the four remainder strands as open children. No decision is involved (embed-vs-modeC is a settled per-demo menu, `#we-fui-embed-boundary` rule 6) — three are FUI *impl* gaps that must land before their demo re-host, one is a WE-side delete:

- **#1765** — FUI cross-list reorder twin: FUI `fui:blocks/renderers/reorderable-list/` is within-list only; port the `renderCrossListReorder` twin + fixtures. *Gates the reorderable-list re-host.*
- **#1766** — FUI loader-background-handoff: `fui:blocks/resource-loader/` lacks `backgroundLoad` + handoff; port `we:blocks/resource-loader/backgroundHandoff.ts` + `we:blocks/resource-loader/handoffContract.ts` + fixtures. *Gates the loader-background-handoff re-host.*
- **#1767** — FUI component renderer: no `fui:blocks/renderers/component/` dir exists (cited #1286/#1289 resolved but delivered other blocks — false edge); 4 WE consumer demos. *Gates the component-adapter re-host.*
- **#1768** — bootstrap-runtime delete (**actionable now**, re-scoped): the plug relocation is already done (#606/#1234/#1046); delete the 6 graduated WE families (`parsers`/`text-nodes`/`for-each`/`transient`/`stores`/`attributes`, all at FUI parity) + repoint 3 `declarative-spa*` demos. `we:blocks/router` stays (#1684 standard derivation); `navigation` already gone.

When an FUI build (#1765/#1766/#1767) resolves, file the trivial demo-swap+delete follow-up for that family. The epic resolves when all children are done.
