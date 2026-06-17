---
type: issue
workItem: epic
parent: "658"
locus: frontierui
status: resolved
dateOpened: "2026-06-17"
dateResolved: "2026-06-17"
graduatedTo: none
tags: []
---

# Move the two exercise apps (loan-origination + auto-insurance) to FUI — #812 Fork-1(a) execution

#812 Fork-1(a) ratified that the two flagship exercise apps — loan-origination (#317) + auto-insurance (#318) — move to FUI: they compose moved block-impl families (audit, lifecycle, master-detail, stepper, tree-select) as CLASSES, which live only in @frontierui/blocks post-#697 and WE cannot import (#707 iframe boundary). Author/host both apps in frontierui as iframe-embed targets, bringing up their renderer-impl deps `renderers/{audit-timeline,data-table,decision-trace,pagination,status-indicator}` (WE keeps the renderer demos); WE then iframe-embeds the apps in the docs showcase and files standard-gaps upstream. The unfiled prerequisite gating #697/#824's app-coupled deletion. (#317/#318 are `active` but all children resolved — re-homing *delivered* apps, not mid-flight; still sequence deliberately.)

## Sliced into 5 children (2026-06-17, `/slice 823`)

Verified against both real trees (see `reports/2026-06-16-backlog-split-analysis.md`). The move is
near-mechanical — FUI already has the router shell (`plugs/bootstrap.ts:204`), auto-scans `demos/*.html`,
and holds all 5 block-impl families (#694); import paths (`../../blocks/…`, `/plugs/bootstrap.ts`) survive
unchanged. The investigation surfaced **two gaps the original body missed**: the 5 renderer-impl deps
aren't in FUI yet, and **loan composes `CustomGuardRegistry`** — a WE *standard model* (not a block-impl
family) with no FUI home — a buried boundary fork now carved to its own decision card. This card is a
**storied epic**; its scope lives in the children. DAG: `#833 → {#835 ∥ (#834 → #836)} → #837`.

- **#833** — bring up the 5 renderer-impl deps (`renderers/{audit-timeline,data-table,decision-trace,pagination,status-indicator}`) to FUI, byte-verified, WE copies kept. `story · 3` — agent-ready now (root).
- **#834** — **decision**: resolve loan's `CustomGuardRegistry` (WE standard model) on the move — bring the guard model UP to FUI vs. decouple loan's guard composition. `type:decision · story · 2`. Blocks #836. *(The guard fork the original body omitted, de-buried here.)*
- **#835** — host `auto-insurance` in FUI (zero WE-only standard dep). `story · 3`, blockedBy #833.
- **#836** — host `loan-origination` in FUI (+ resolve guard per #834). `story · 3`, blockedBy #833, #834.
- **#837** — WE iframe-embeds both FUI-hosted apps in the docs showcase + file residual standard-gaps. `story · 2`, blockedBy #835, #836; unblocks #824.
