---
kind: story
size: 8
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "we:plugs/webstates/VersionedStorageStrategy.ts"
tags: []
---

# webstates: build the client-storage schema-versioning facet (per-key envelope default)

## Progress (batch-2026-06-20) — DONE

Built `we:plugs/webstates/VersionedStorageStrategy.ts` per the #1251 ruling — a thin versioning facet
**above** `CustomStorageStrategy` (Fork 2 → A; home webstates, Fork 1 → A):
- **Wrapper strategy** `VersionedStorageStrategy` (+ `versioned()` factory) wraps any inner strategy →
  every engine gets versioning for free, riding the IndexedDB→localStorage degrading path (#1108). Drop-in
  `CustomStorageStrategy` (delegates get/set/delete/keys/bulk/subscribe).
- **Per-key `{v,data}` envelope** (Fork 3 default granularity) — `set` wraps with the current `version`;
  `get` (lazy, #1108) unwraps + compares `v`.
- **Mismatch policy** — older `v` / legacy un-enveloped value / (with `detect`) structurally-invalid payload
  → run the registered `migrate` (author opt-in) else **discard → defaults** (return `undefined`, the
  #1251 default). Migration **heals the store on read** by default (`persistMigrated`, lazy #1108);
  opt-out for side-effect-free reads.
- **Support-both axes** — detection = version stamp default + `detect` for structural `safeParse`-style;
  mismatch = discard default + `migrate` to upgrade. Exported from `we:plugs/webstates/index.ts`.
- 9 unit tests (`we:plugs/webstates/__tests__/unit/VersionedStorageStrategy.test.ts`) over an in-memory
  inner strategy. Gate green. Fixes the #487 stale-state footgun generically.

Per-store single-sidecar granularity (the per-Fork-3 opt-in) is a follow-on shape, not built here.
Implement the #1251-ratified versioning facet above CustomStorageStrategy: a thin engine-agnostic wrapper on the strategy read/write path that detects when stored client state predates the reading schema and either runs a registered migration or discards to defaults. Default detection = version stamp; default mismatch policy = discard→defaults; default granularity = per-key {v,data} envelope (per-store single-sidecar opt-in). Read-time/lazy application riding the registry's IndexedDB→localStorage degrading read path (#1108). Home = webstates. Fixes the #487 stale-filter-state footgun generically.
