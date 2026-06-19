---
type: idea
workItem: story
size: 3
parent: "1089"
status: resolved
blockedBy: ["1106"]
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: "we:plugs/webstates/CustomStorageStrategyRegistry.ts"
tags: []
---

# webstates: CustomStorageStrategyRegistry + IndexedDB to localStorage degradation

we:plugs/webstates/CustomStorageStrategyRegistry.ts extends HTMLRegistry, per-scope active(), built-in degradation chain per spec we:src/_includes/project-webstates.njk:312-327. Demo: IndexedDB-unavailable degrades to localStorage transparently.

## Progress

Shipped `we:plugs/webstates/CustomStorageStrategyRegistry.ts` — per-scope storage selection + built-in
degradation:
- Value-keyed over `CustomStorageStrategy` (extends `CustomRegistry`, same base correction as #1107 —
  HTMLRegistry's node-constructor bimap doesn't fit a value instance). `define(strategy, asActive?)`,
  `active()` nearest-scope-wins through `extends`, `setActive`/`activeKey`.
- **Built-in degradation chain IndexedDB → localStorage**: `run(op)` tries the active engine and, on a
  thrown op, transparently falls through the chain to the next strategy. Degrading CRUD wrappers
  `read`/`persist`/`remove`/`listKeys`/`bulkWrite` (named distinctly so they don't shadow the inherited
  registry map API get/set/delete/keys — those manage REGISTRATION, these manage DATA). Spec §"Per-Scope
  Selection & Degradation", njk:312-327.
- `createDefaultStorageStrategyRegistry()` registers IndexedDB active when the platform has it, else the
  localStorage floor becomes active — transparent degradation, no caller change.

Unit test `__tests__/unit/CustomStorageStrategyRegistry.test.ts` 6 green (default degrades to localStorage
in happy-dom, operational IndexedDB→localStorage fall-through round-trips, all-fail rethrow, registry map
API intact, nearest-scope override, empty-registry throw). WE `check:standards` 0 errors.
