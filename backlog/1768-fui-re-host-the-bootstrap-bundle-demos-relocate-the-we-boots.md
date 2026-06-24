---
kind: epic
status: open
locus: frontierui
dateOpened: "2026-06-24"
tags: [frontierui, demos, dogfood, fui-build-gate]
---

# FUI re-host the bootstrap-bundle demos + relocate the WE bootstrap plug, then delete the 7 bootstrap block families

Sub-epic of #1353: `we:plugs/bootstrap.ts` is a single importer shared by 11 demos (router/navigation/parsers/text-nodes/for-each/transient/attributes + stores) — not per-family sliceable. Re-host all 11 demos FUI-side, relocate `we:plugs/bootstrap.ts`, then bulk-delete the 7 bootstrap families + stores.
