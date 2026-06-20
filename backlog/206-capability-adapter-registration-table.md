---
kind: story
size: 5
parent: "203"
status: resolved
dateOpened: "2026-06-08"
dateStarted: "2026-06-08"
dateResolved: "2026-06-08"
graduatedTo: src/_data/capabilityMatrix.json
tags: [capability-provider, adapters, adapters-json, registration, capability-vocabulary, native-first]
crossRef: { url: /backlog/203-capability-provider-resolution-architecture/, label: "Adapter-table story of epic #203" }
---

# Capability adapter registration table

Per the **adapter granularity & ownership** ruling in
[#203](/backlog/203-capability-provider-resolution-architecture/) (resolved by D4′): a **central
registered table** (the existing `we:adapters.json` pattern), not per-impl scattered adapters.

## Scope

- **Central table** — one registered adapter row per impl, each declaring its **capability ID → tier**
  map (3-state: native-ok / polyfill-ok / capability-hard), keyed off #204's capability vocabulary.
  Follow the repo's existing `we:adapters.json` pattern (registered, hot-reloadable — see the
  [adapter pages require-cache](../docs/) fix history).
- **Ownership distributed, storage central** — each impl *authors* its row, but registration lives in
  one discoverable table. Rationale: the provider must enumerate **all** impls to resolve native-first
  (it needs the whole table anyway), and one table is auditable.
- **Feeds the provider** — the static build-matrix ([#204](/backlog/204-capability-vocabulary-provider-interface-matrix/))
  is assembled from these adapter rows (matrix = impls × capability IDs). Confirm whether the matrix is
  *derived from* the adapter table or the adapter table *is* the matrix's row source — keep one source
  of truth, no duplicated capability facts.
- **DoD** — adapter rows for the droplist family's impls (native `base-select`, custom FACE) registered
  and queried by the provider; adding a new impl is a single-row registration; `check:standards` green
  (add a validator for the adapter-row shape if a discovery surface needs one — see
  [catalogs auto-render](../docs/) note).

## Progress

- **Status:** resolved (2026-06-08)
- **Branch:** docs/standard-authoring-workflow
- **Source-of-truth ruling:** the adapter table **is** the matrix's row source — one file, no split.
  `we:capabilityMatrix.json` → `impls[]` *is* the registered capability adapter table; the build-matrix
  grid is assembled from these rows. Splitting into a parallel file would duplicate capability facts
  (the scope forbids it), so #206 elevated the row to a first-class registered artifact in place
  rather than relocating data.
- **Done:**
  - **First-class adapter type** — `we:capabilities/provider.ts`: `CapabilityAdapter` (the registered
    row: `id` + human `label`/`summary` + optional `native` + `tiers` map), with `MatrixImpl` kept as
    a deprecated alias. `CapabilityProvider.adapters(): CapabilityAdapter[]` accessor + impl in
    `StaticMatrixProvider` (stores the rows, returns them for discovery surfaces).
  - **Registered table export** — `we:capabilities/index.ts`: `capabilityAdapters` = the shipped
    `impls[]` rows, the single source of truth the catalog + provider + resolver all read.
  - **Registration-shape validator** — `check:standards` 6c-bis reframed: validates each `impls[]`
    row as a registration record (required `id`/`label`/`summary`/`tiers`, unique id, `native`
    boolean, complete tier map, ≤1 native substrate; new warn when **zero** native registered →
    native-first has no substrate to prefer on a tie).
  - **Tests** — `we:provider.test.ts`: `adapters()` accessor + the DoD **single-row-registration** test
    (append one row → provider enumerates + tiers it, no other change) + shipped table registers
    `face` + `base-select`.
  - **Discovery surface + docs** — `/capabilities/` section reframed to "The registered capability
    adapter table" with the ownership-distributed/storage-central + single-row-registration note;
    `we:capabilityMatrix.json` description updated; `we:docs/agent/design-first.md` authoring note for
    "Registering a capability adapter (a new impl)".
- **Next:** strictness/cascade (#207), runtime/edge impls (#208) build on this. Follow-up filed: #216
  (per-registered-adapter detail pages, mirroring `we:adapters.json`'s `adapter-descriptions/{id}.njk`).
- **Notes:** Gates green — 1670 vitest pass (23 in `capabilities/`), `check:standards` 0 errors
  (14 capabilities), live `/capabilities/` 200 with the new framing. No data relocated: ownership
  distributed, storage central, one source of truth.

**Graduated to** `we:src/_data/capabilityMatrix.json` — impls[] registered-adapter table + CapabilityAdapter type / provider.adapters() + check:standards row-shape validator.
