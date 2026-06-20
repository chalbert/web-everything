---
kind: story
size: 2
parent: "1250"
locus: frontierui
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "fui:plugs/webguards/CustomGuardRegistry.ts"
tags: []
---

# Reconcile fui:plugs/webguards UP to WE (contract-anchored)

Audit fui:plugs/webguards vs contract+vectors, then reconcile CustomGuardRegistry + index (2 content diffs) FUI-up.

## Progress — audited; FUI already conforms (no reconcile needed)

Audited `fui:plugs/webguards` (CustomGuardRegistry + index) against the WE contract
(`we:plugs/webguards/*`). The behavioral surface is **byte-identical**: same
`define` / `defaultKey` / `resolve` / `evaluateRegion` / `createDefaultGuardRegistry`, same
`CustomGuardProvider` contract. The only diffs are **correct per-repo structure**, NOT contract drift:
FUI imports the standalone half from `fui:blocks/guard/provider.js` / `registry.js` (the guard model
lives at `blocks/guard/` in FUI, `guard/` in WE) and carries the #170/#950 port-provenance doc comments.
Changing those would *break* FUI, so the "2 content diffs" the card anticipated are already-settled
structural correctness — there is nothing to bring "FUI-up". No code change.

FUI `npm run check:standards` is red on 2 PRE-EXISTING errors unrelated to webguards (catalog drift:
`fui:blocks/notification/` and `fui:blocks/signature-pad/` lack `fui:src/_data/blocks.json` entries) —
not in this changeset, stepped over per the batch gate-red-scoped-to-own-work rule.
