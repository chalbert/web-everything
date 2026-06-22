---
kind: epic
status: open
locus: frontierui
dateOpened: "2026-06-20"
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

## Remainder — could-not-split-here, gated on FUI build (re-`/slice` as each gap clears)

No decision involved (embed-vs-modeC is a settled per-demo menu, `#we-fui-embed-boundary` rule 6) — each is an FUI *impl* gap:

- **loader-background-handoff** (`resource-loader`) — FUI lacks `backgroundLoad` + the `reference-receiver`/`handoff-scenarios` fixtures.
- **reorderable-list** (`renderers/reorderable-list`) — FUI missing `renderCrossListReorder` + `__fixtures__`.
- **component-adapter** (`renderers/component`, 4 WE consumers) — no `fui:blocks/renderers/component/`; tied to component-block gaps #1286/#1289.
- **7 bootstrap families + `stores`** (`router/navigation/parsers/text-nodes/for-each/transient/attributes`) — single importer `we:plugs/bootstrap.ts` shared by 11 demos; not per-family sliceable. Needs all 11 bootstrap demos re-hosted + `we:plugs/bootstrap.ts` relocated ([constellation-placement](docs/agent/platform-decisions.md#constellation-placement), #606, dropped stale — reopen), then bulk-delete. A future sub-epic.
