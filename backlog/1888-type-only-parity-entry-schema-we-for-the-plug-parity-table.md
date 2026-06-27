---
kind: task
parent: "1836"
status: resolved
dateOpened: "2026-06-27"
dateStarted: "2026-06-27"
dateResolved: "2026-06-27"
graduatedTo: plug-parity/contract.ts
tags: []
---

# Type-only parity-entry schema (WE) for the plug parity table

WE. The only WE-resident parity artifact #1839 permits: a type-only schema for the parity-entry shape (per #1282 zero-impl — the measured verdict lives FUI-side, values never in WE). Mirror the existing we:src/_data/plugs/*.json contract shape. Consumed by the FUI manifest (S5a) and the doc page (#1844).

## Progress (batch-2026-06-27)

Authored the canonical type-only module `we:plug-parity/contract.ts` (compile-erased, zero runtime emit)
and re-exported it as the `@webeverything/contracts/plug-parity` subpath
(`we:contracts/plug-parity.ts` + the `we:contracts/package.json` exports entry) — mirroring the
`webpolicy`/`guard` contract pattern (canonical at root, contracts/ is the published facade FUI depends on
via the FUI→WE arrow). Three exports: `PlugParityState` (the #1839 3-state enum), `PlugParityCapability`
(one verdict — `note` mandatory for caveat, `residue` mandatory for plugged-only, optional `pendingPort`
for not-yet-ported rows), and `PlugParityManifest` (the per-plug file shape). Types exactly match the
#1887-seeded `fui:plugs/webinjectors/parity.json` data; no values in WE.
