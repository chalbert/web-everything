---
kind: story
size: 8
parent: "746"
status: resolved
dateOpened: "2026-06-24"
dateStarted: "2026-06-26"
dateResolved: "2026-06-26"
graduatedTo: 746
tags: []
---

# FUI workbench thin-descriptor registry + /_maas/ loader (split acquisition)

Build the #1731 ratification (Fork 2 = split acquisition): replace the hardcoded WorkbenchBlock load/create/cem/authorSource closures in fui:workbench/registry.ts with thin per-block descriptors + a loader. Native primary stage loads via direct import() of the authoritative FUI element; polyglot React/Vue live forms load from the cross-origin /_maas/ serve URL (#1499); source-only blocks carry no loadable shape (#1701 relaxed contract); add an opt-in as-served secondary native view. servePathIR stays executable-only. Pairs with #1618 (source/CEM data route + consumption). Parent #746; enabled by ratified #1731.

## Progress (batch-2026-06-26-1745-1775)

Built the #1731 Fork-2 ratification (split acquisition): replaced the hardcoded `load`/`create` closures on
`fui:workbench/registry.ts`'s `WorkbenchBlock` with a thin declarative `shape` + an optional `seed`, and a
shared loader that owns acquisition.
- `fui:workbench/loader.ts` — `BlockShape` discriminated union + `loadBlockShape()`:
  - `native` — primary stage via direct `import()` of the authoritative FUI element (load thunk registers
    it) + `createElement(tag)`; full fidelity, no serve round-trip (#1731: native is NOT URL-resolved);
  - `served` — a polyglot React/Vue live form via a cross-origin `import()` of the `/_maas/` serve URL
    (#1499/#1518);
  - `source-only` — no loadable shape (#1701 relaxed contract) → loader returns `null`.
- `fui:workbench/registry.ts` — `WorkbenchBlock.shape: BlockShape` + `seed?: (el) => void` (the irreducible
  block-specific instance seeding the bare `createElement` can't express); `auto-complete` migrated to a
  `native` shape + `seed`.
- `fui:workbench/mount.ts` — acquires via `loadBlockShape(block.shape)` once; a `createInstance()` helper
  applies `seed` and degrades a source-only block to a stage placeholder. Replaced the 3 `block.load()`/
  `block.create()` call sites.
- `fui:workbench/__tests__/loader.test.ts` — 4 loader tests (native load+create, fresh instances,
  source-only null, served discriminant). `servePathIR` stays executable-only (#1731 Fork 1).

Scope: the descriptor/loader split (Fork 2). The source/CEM data route + consumption is the paired #1618.
FUI gate baseline-steady (34); 30 existing workbench tests + 4 new loader tests green; tsc clean. The live
mount is covered by the existing `fui:workbench/__tests__/e2e/workbench.spec.ts` e2e (not re-run in this batch).
