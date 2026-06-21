---
kind: epic
locus: frontierui
status: resolved
dateOpened: "2026-06-20"
dateResolved: "2026-06-21"
graduatedTo: none
tags: [fui, gap, dogfood, plateau-app]
---

> **Sliced 2026-06-20 (`/slice 1286`).** Umbrella for the 4 greenfield a11y form-control builds FUI is
> missing — carved into per-control story slices, each `size 3`, mapping to the ratified WE input/selection
> intents: **#1339 radio · #1340 checkbox · #1341 text-field · #1342 number-input** (4-wide parallel, no
> inter-slice edges). Split rationale in `we:reports/2026-06-20-backlog-split-analysis.md`. All four shipped
> unblocks the two #1254 configurator-migration slices.

# FUI form-control blocks (radio, checkbox, text-field, number input) — gap blocking plateau-app configurator dogfood

FUI ships droplist/type-ahead/selection but NO basic form-control blocks: radio, checkbox, single-line text-field, number input. The #1254 plateau-app dogfood found its Intent Configurator (we:plateau:src/intent-configurator/configurator.ts) and Technical Configurator (we:plateau:src/technical-configurator/configurator.ts) are hand-rolled over these missing controls, so those surfaces are could-not-split until FUI ships them. Per first-party-dogfood, the residue is a gap to file. locus: frontierui. Unblocks the two configurator migration slices once shipped.
