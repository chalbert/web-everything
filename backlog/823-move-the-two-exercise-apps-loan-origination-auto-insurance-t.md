---
type: issue
workItem: epic
parent: "658"
locus: frontierui
status: open
dateOpened: "2026-06-17"
tags: []
---

# Move the two exercise apps (loan-origination + auto-insurance) to FUI — #812 Fork-1(a) execution

#812 Fork-1(a) ratified that the two flagship exercise apps — loan-origination (#317) + auto-insurance (#318) — move to FUI: they compose moved block-impl families (audit, lifecycle, master-detail, stepper, tree-select) as CLASSES, which live only in @frontierui/blocks post-#697 and WE cannot import (#707 iframe boundary). Author/host both apps in frontierui as iframe-embed targets, bringing up their renderer-impl deps `renderers/{audit-timeline,data-table,decision-trace,pagination,status-indicator}` (WE keeps the renderer demos); WE then iframe-embeds the apps in the docs showcase and files standard-gaps upstream. The unfiled prerequisite gating #697/#824's app-coupled deletion. (#317/#318 are `active` but all children resolved — re-homing *delivered* apps, not mid-flight; still sequence deliberately.)
