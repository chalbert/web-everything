# Client storage schema versioning + migration — prior art and prepared forks

**Date:** 2026-06-20 · **Backlog:** [#1251](/backlog/1251-client-storage-schema-versioning-migration-migrate-or-discar/) (decision) · **Project:** webstates · **Research topic:** [Client Storage Schema Versioning & Migration](/research/client-storage-schema-versioning/)

## Why this report

#1251 wants a standard for evolving **persisted client state** safely — stamp a schema version, and on a mismatch run a registered migration or safely discard to defaults. The origin is the [#487](/backlog/487-single-kind-axis-migration/) kind-axis rename: it changed the board's filter-state `localStorage` keys, the new code defaults to "no filter" on a missing key, so the server was fine but a returning browser carrying the **old** saved shape rendered a broken table until a hard refresh. Generic failure mode: **persisted client state outlives the schema that wrote it.**

This is distinct from the existing storage **mechanism** — `webstates` already ships the durable-store contract ([#503](/backlog/503-build-the-webstates-storage-protocol/) ruling), the `CustomStorageStrategy` contract + native strategies ([#1106](/backlog/1106-webstates-storage-contract/)), and the per-scope registry with IndexedDB→localStorage degradation ([#1108](/backlog/1108-webstates-storage-strategy-registry/)). What is missing is **schema evolution** over whatever the mechanism persists.

## Prior-art survey (full table in the research topic)

- **IndexedDB native** — integer DB `version` + `onupgradeneeded(oldVersion, newVersion)` in a `versionchange` transaction; **migrate-forward**, **per-DB/store** granularity, applied **at open time**, `blocked` event for stale tabs. webstates' own `IndexedDBStrategy` already bumps the version to create a store ([we:plugs/webstates/CustomStorageStrategy.ts:117](../plugs/webstates/CustomStorageStrategy.ts#L117)).
- **redux-persist** — `version` + `createMigrate({ [v]: fn })` runs migrations **sequentially** stored+1→current; stores a `_persist: {version}` **envelope**; no path ⇒ discard to reducer defaults. The closest match to #1251's sketch.
- **Zustand persist** — `version` + `migrate(state, fromV)`; no `migrate` ⇒ discard. Second independent witness.
- **TanStack Query `persistClient`** — `buster` string; mismatch ⇒ **discard the whole cache** (no migration). Validates discard→defaults as a standalone policy.
- **localForage** — mechanism-only, no versioning. Confirms versioning is an orthogonal layer storage libs don't provide.
- **Zod/valibot `safeParse`** — **structural** detection (re-validate against the current schema, no version integer); failure ⇒ discard. The alternative to a version stamp.
- **Service Worker Cache Storage** — versioned cache name, discard old on `activate`. Coarse discard-by-rename.

### Two orthogonal axes the survey isolates

1. **Detection** — explicit version stamp (native / redux / zustand) **vs.** structural re-validation (Zod). Independent.
2. **Mismatch policy** — migrate-forward via an ordered registry **vs.** discard→defaults. Independent.

Every library is one cell of that 2×2; a standard should support both columns and default to one. **Convergent ergonomic pattern:** envelope + ordered migration registry, run **lazily on read**, with **discard→defaults** when no migration path exists.

## Grounding correction (reshaped Fork 1)

The item asserted webreliability is "an empty `concept` stub" and that seeding it "gives that concept project a real reason to exist." **Both are inaccurate.** `webreliability` is `status: concept` ([we:src/_data/projects/webreliability.json](../src/_data/projects/webreliability.json)) but already carries a full mission, the recovery-handler registry, the error-recovery protocol, and demos — see [we:src/_includes/project-webreliability.njk](../src/_includes/project-webreliability.njk), whose ratified mission is **"mechanism failure recovery — what happens when an operation fails (network timeout, server error, database unreachable, computation crash)."** A schema-version mismatch is **data-shape evolution, not an operation failure**, so it does not fit that ratified boundary (the discard fallback merely *rhymes* with graceful degradation). This strengthens the webstates home and removes B's stated rationale.

## Per-fork classification (against the architecture)

- **Layer / home.** It operates on persisted state — webstates' domain (#503 storage protocol explicitly owns "the durable structured-record store"). → webstates.
- **Protocol or intent dimension; form.** Native makes versioning intrinsic to the engine, but the libraries layer it *above* the mechanism, engine-agnostic — so a thin facet over the existing `CustomStorageStrategy` read path, not baked per-strategy (separate/decouple bias; burden on combining).
- **Expose the whole axis / fixed mechanic.** Detection and policy are both **support-both** axes (a store may opt into structural validation, and may register migrations); only the *defaults* are calls — version-stamp detection, discard→defaults policy (most-resilient / most-flexible default).
- **Most-permissive default.** discard→defaults never renders stale-shaped state; migration is the author's opt-in.
- **Seam.** Read-time application sits on the registry's degrading read path ([we:plugs/webstates/CustomStorageStrategyRegistry.ts:98](../plugs/webstates/CustomStorageStrategyRegistry.ts#L98)), tying the degraded-but-working guarantee to the existing #1108 IndexedDB→localStorage chain.

## Prepared forks (full shape in the item)

- **Fork 1 — Home:** webstates (default) vs webreliability. Lean webstates ~80%.
- **Fork 2 — Form:** thin engine-agnostic versioning facet *above* `CustomStorageStrategy` (default) vs a standalone new intent/protocol vs baked per-strategy. Lean facet-above ~70%.
- **Fork 3 — Granularity + envelope:** per-store version as a single sidecar record (default, mirrors native + redux + zustand) vs per-key `{v,data}` envelope (suits loose localStorage keys). **Low confidence / divergent — the one real call.**
- **Supported by default:** migrate-or-discard (default **discard→defaults**); version-stamp detection (structural-validation opt-in); lazy read-time application; degraded-but-working guarantee tied to #1108.

## Open call left for `/next decision`

The placement and form forks are high-confidence ratifications; the genuine judgment call is **Fork 3 granularity** (per-store vs per-key) — flagged low-confidence for a skeptic pass, since the concrete #487 footgun is loose per-key `localStorage` state while the prior art overwhelmingly versions per-store.
