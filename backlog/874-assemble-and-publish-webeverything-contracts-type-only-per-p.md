---
type: issue
workItem: story
size: 3
parent: "872"
status: resolved
blockedBy: ["873"]
dateOpened: "2026-06-17"
dateStarted: "2026-06-17"
dateResolved: "2026-06-17"
graduatedTo: "contracts/package.json (@webeverything/contracts — type-only per-protocol subpath exports re-exporting the #873 planes + #879 family contract halves; SoT replacing byte-replication)"
tags: []
---

# Assemble and publish @webeverything/contracts (type-only, per-protocol subpath exports)

Build the @webeverything/contracts package: a type-only npm package re-exporting each WE protocol's pure-contract module (from #873) under a per-protocol subpath export (e.g. @webeverything/contracts/guard), so consumers import only what they use. Package name == contract specifier per #239. Keeps @webeverything reserved for standard artifacts; FUI (and any impl) depends on it (FUI→WE arrow). Type-only means zero runtime emit. Establishes the single source of truth that replaces byte-replication.

## Progress

Done. New top-level package `contracts/` following the WE sibling-package convention (cf. `capability-manifest/`, `validation-generation/`): `package.json` `@webeverything/contracts`, `version 0.0.0`, `type: module`, `private: true`, with nine **per-protocol subpath exports** and no kitchen-sink root export (consumers import only what they use).

Each subpath resolves to a thin barrel `*.ts` that `export type *`s the canonical pure-contract module in place — the contract.ts files stay next to their runtime (so the runtime's own `export type * from './contract'` re-export, #873/#879, keeps working) and this package just surfaces them under the scoped specifier. A barrel is needed because Node `exports` can't escape the package dir with `../`; the barrel's internal `../…/contract` import is resolved by the consumer's bundler/tsc:

- `./guard`, `./validity-merge`, `./validator-resolution` → the #873 WE-owned planes.
- `./audit`, `./lifecycle`, `./master-detail`, `./selection`, `./stepper`, `./tree-select` → the #879 #694-family halves.

Type-only / zero runtime emit verified: `tsc --noEmit` clean on all nine barrels; emitting any barrel produces only `export {};`. `check:standards` 0 errors. Consumer wiring (FUI imports the specifier via tsconfig paths + vite alias, #804 2a) is #875; an actual npm publish is the deferred #804 2b build. This package is the SoT that replaces byte-replication (#170) once #875 repoints FUI.
