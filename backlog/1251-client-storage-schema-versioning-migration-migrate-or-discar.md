---
kind: decision
status: open
dateOpened: "2026-06-20"
tags: []
---

# Client storage schema versioning + migration (migrate-or-discard on version mismatch)

A standard for evolving PERSISTED client state safely: stamp a schema version on each stored shape, and on a version mismatch run a registered migration or safely discard (degrade to defaults) — so a renamed/changed key never silently breaks the UI (the stale localStorage filter-state break after the #487 kind-axis rename). Distinct from the existing storage MECHANISM (webstates StoragePersistence #1106 + strategy registry #1108, which cover backend choice + IndexedDB→localStorage degradation). The open call is placement + shape: a versioning intent extending webstates StoragePersistence, vs seeding the webreliability project as a resilience-protocols home.

## Motivation — the concrete footgun

The #487 backlog kind-axis migration renamed the board's filter-state localStorage keys
(`we-type-filter`/`we-workitem-filter` → `we-kind-filter`, `we-backlog-priority-type` →
`-kind`). The new code defaults to "no filter" when it can't find its key, so the *server* was
fine — but a returning browser carrying the **old** saved state rendered the table as broken
until a hard refresh. That is the generic failure mode: **persisted client state outlives the
schema that wrote it.** Today every store re-invents (or skips) its own ad-hoc guard. A standard
makes the safe path the default.

## What it would standardise (sketch — not yet ratified)

- A **version stamp** co-located with each persisted shape (`{ v, data }` envelope, or a sidecar
  version key) — per-key or per-store granularity is itself a sub-call.
- A **migration registry**: ordered `vN → vN+1` transforms run lazily on read; a missing path
  falls through to the discard policy.
- A **migrate-or-discard policy** with a safe **default = discard→defaults** (most flexible /
  most resilient: never render stale-shaped state), migration being the author's opt-in.
- Read-time application + a degraded-but-working guarantee (ties to the existing
  IndexedDB→localStorage degradation in #1108).

## The decision — placement + shape

**Fork 1 — where does it live?**

- **A — an intent/protocol extending `webstates` `StoragePersistence`** *(lean, ~65%)*. It operates
  directly on persisted state, which is webstates' domain (#503/#1106/#1108); keeps the storage
  contract cohesive — versioning is a facet of "durable client persistence", not a separate
  product. Reliability is the *motivation*, webstates the *home*.
- **B — seed the `webreliability` project** (today an empty `concept` stub) as the home for
  cross-cutting graceful-degradation / resilience protocols, with schema-migration its first
  concrete member. Gives that concept project a real reason to exist; risk: splits storage
  concerns across two projects.

**Fork 2 — shape sub-calls** (settle once placement lands): per-key vs per-store version
granularity; envelope (`{v,data}`) vs sidecar version key; migrate-or-discard default
(lean: **discard→defaults**, per most-flexible-default).

Needs a design-first research pass (survey: redux-persist migrations, idb `onupgradeneeded`,
TanStack Query persist `buster`, localForage) before ratification — not yet prepared.

## Related

- webstates storage protocol #503, StoragePersistence contract #1106, CustomStorageStrategyRegistry #1108
- Origin: the #487 single-kind-axis migration's stale-filter-state break.
