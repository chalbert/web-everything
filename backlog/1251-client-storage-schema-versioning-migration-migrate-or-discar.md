---
kind: decision
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: none
codifiedIn: "docs/agent/platform-decisions.md#data-shape-vs-mechanism-failure"
preparedDate: "2026-06-20"
relatedReport: "reports/2026-06-20-client-storage-schema-versioning.md"
tags: []
---

# Client storage schema versioning + migration (migrate-or-discard on version mismatch)

A standard for evolving **persisted client state** safely: detect when a stored shape predates the
schema that reads it, and either run a registered migration or safely discard to defaults — so a
renamed/changed key never silently breaks the UI. **Grounding:** the forks below are grounded in a
prior-art survey published as the [Client Storage Schema Versioning &
Migration](/research/client-storage-schema-versioning/) research topic (session report linked via
`relatedReport`). **RATIFIED 2026-06-20** — see *Ruling* below. Distinct from the storage **mechanism** (the durable-store contract
#503, `CustomStorageStrategy` + native strategies #1106, the per-scope registry + IndexedDB→localStorage
degradation #1108) — that owns *where* state persists; this owns *how the shape evolves over time*.

## Ruling — ratified 2026-06-20

The decision exposed a clean partition: **two WE-internal architecture forks** (which the developer never
sees — WE must pick) and **three developer-facing behavior axes** (which WE supports both of, picking a
default). No axis is a *mandate* on the developer.

- **Fork 1 — Home → webstates** (A). Versioning operates directly on persisted state = webstates' domain.
  webreliability's seed premise is verified false: its ratified mission is *mechanism-failure recovery,
  explicitly "not input invalidity"* ([we:src/_data/projects/webreliability.json](../src/_data/projects/webreliability.json)) —
  a schema-shape mismatch is data evolution, outside that boundary. ~80%.
- **Fork 2 — Form → thin versioning facet above `CustomStorageStrategy`** (A). Wrap the strategy read/write
  path once → every engine gets versioning for free, riding the registry's existing IndexedDB→localStorage
  degrading read path ([we:plugs/webstates/CustomStorageStrategyRegistry.ts:98](../plugs/webstates/CustomStorageStrategyRegistry.ts#L98)).
  Standalone intent over-separates a facet of an existing contract; baking per-strategy violates DRY and
  wouldn't cover the localStorage floor uniformly. ~70%.
- **Fork 3 — Granularity → dissolved into a developer-configurable dimension, default per-key.** Per-store
  and per-key are both legitimate on-disk end-states for different store topologies (dimension-vs-fixed-mechanic
  test passes), so granularity is **not** a WE-mandated single shape — the author configures it, defaulting
  to the **per-key `{v,data}` envelope**. Rationale for the default: webstates' real topology is many small
  independent persisted values (the #487 footgun world), and the per-store prior-art consensus
  (redux-persist/Zustand) is an artifact of those ecosystems having a single root store; the localStorage
  floor has no native versioning, so per-key is the shape that covers both engines uniformly and removes the
  shared-counter coupling (changing key X must not force-invalidate unrelated key Y). Per-store stays
  available for cohesive single-`T` scopes. Most-flexible default. ~65%.

**Developer-facing axes — all support-both, defaults recorded** (none is a fork): detection = **version
stamp** default (structural `safeParse` opt-in); mismatch policy = **discard→defaults** default (registered
migration is the author's opt-in); granularity = **per-key** default (per-store opt-in, per Fork 3).

Successor build (now agent-ready): **#1295** (see *Related*).

## Motivation — the concrete footgun

The [#487](/backlog/487-single-kind-axis-migration/) kind-axis migration renamed the board's filter-state
`localStorage` keys (`we-type-filter`/`we-workitem-filter` → `we-kind-filter`,
`we-backlog-priority-type` → `-kind`). The new code defaults to "no filter" when it can't find its key,
so the *server* was fine — but a returning browser carrying the **old** saved state rendered the table as
broken until a hard refresh. Generic failure mode: **persisted client state outlives the schema that
wrote it.** Today every store re-invents (or skips) its own ad-hoc guard; a standard makes the safe path
the default.

## Axis framing — the orthogonal axes the survey isolated

The research decomposes the concern into independent axes, each pinned to the real tree:

- **Home** — which project owns it. webstates already owns the durable-store contract
  ([we:src/_includes/project-webstates.njk:329](../src/_includes/project-webstates.njk#L329) scope-boundary
  table) and the strategy contract ([we:plugs/webstates/CustomStorageStrategy.ts:22](../plugs/webstates/CustomStorageStrategy.ts#L22)).
- **Form** — a thin versioning facet *above* the existing strategy contract vs a standalone new intent vs
  baked per-strategy. The native model bakes it into the engine
  ([we:plugs/webstates/CustomStorageStrategy.ts:117](../plugs/webstates/CustomStorageStrategy.ts#L117)
  `onupgradeneeded`); the libraries layer it above the mechanism, engine-agnostic.
- **Detection** — explicit version stamp vs structural re-validation (Zod `safeParse`). *Support-both axis.*
- **Mismatch policy** — migrate-forward via an ordered registry vs discard→defaults. *Support-both axis.*
- **Granularity + envelope** — per-store single version record vs per-key `{v,data}` envelope. Read-time
  application rides the registry's degrading read path
  ([we:plugs/webstates/CustomStorageStrategyRegistry.ts:98](../plugs/webstates/CustomStorageStrategyRegistry.ts#L98)),
  tying the degraded-but-working guarantee to the existing #1108 IndexedDB→localStorage chain.

## Recommended path at a glance

| Fork | Ratified outcome | Confidence |
|---|---|---|
| **1 — Home** | **webstates** (storage-facet) | High (~80%) |
| **2 — Form** | **thin versioning facet *above* `CustomStorageStrategy`** | Med-high (~70%) |
| **3 — Granularity + envelope** | **dissolved → developer-configurable dimension, default per-key `{v,data}` envelope** (per-store opt-in) | ~65% |

*Support-both (no fork):* detection defaults to a **version stamp** (structural-validation opt-in);
mismatch policy supports both migrate and discard, defaulting to **discard→defaults**; granularity is
configurable, defaulting to **per-key** (Fork 3).

## Fork 1 — Home: which project owns it

*Fork-existence:* placement is exclusive — the capability lives in exactly one project, and webstates
(storage facet) and webreliability (resilience protocol) are both coherent homes that genuinely cannot
co-own it.

- **A — webstates** *(recommended, ~80%)*. It operates directly on persisted state, which is webstates'
  domain (#503/#1106/#1108); keeps the storage contract cohesive — versioning is a facet of "durable
  client persistence", not a separate product. The native platform makes versioning intrinsic to the
  persistence layer (IndexedDB `version`), reinforcing it as a storage facet. Reliability is the
  *motivation*; webstates is the *home*.
- **B — seed webreliability** as a resilience-protocols home. *Rejected as default — its premise is
  false.* The item originally claimed webreliability is "an empty `concept` stub" that this would "give a
  reason to exist." It is `status: concept`
  ([we:src/_data/projects/webreliability.json](../src/_data/projects/webreliability.json)) but already
  carries a full mission, the recovery-handler registry, the error-recovery protocol, and demos
  ([we:src/_includes/project-webreliability.njk](../src/_includes/project-webreliability.njk)). Its
  **ratified** mission is "mechanism failure recovery — when an operation fails (network timeout, server
  error, database unreachable, computation crash)." A schema-version mismatch is **data-shape evolution,
  not an operation failure**, so it falls outside that ratified boundary (the discard fallback merely
  *rhymes* with graceful degradation). Residual: the discard-to-defaults policy *is* a degradation
  behaviour, so a future cross-project resilience seam could reference it — but the home is webstates.

## Fork 2 — Form: how it attaches to the storage layer

*Fork-existence:* these are mutually-exclusive structural homes for the same logic — the read-time
version-check+migrate cannot live in three places at once.

- **A — a thin versioning facet *above* `CustomStorageStrategy`** *(recommended, ~70%)*. An engine-agnostic
  layer that wraps the strategy read/write path so every strategy (IndexedDB, localStorage, future
  remote/OPFS) gets versioning for free, exactly once. Matches redux-persist / Zustand (which layer
  versioning over the storage mechanism) and the WE separate/decouple bias (burden of proof on combining).
  Read-time application sits on the registry's existing degrading read path
  ([we:plugs/webstates/CustomStorageStrategyRegistry.ts:98](../plugs/webstates/CustomStorageStrategyRegistry.ts#L98)).
- **B — a standalone new intent/protocol.** *Rejected as default* — heavier; versioning is meaningless
  without a persistence layer to attach to, so a free-standing protocol over-separates a facet of an
  existing contract.
- **C — baked into each `CustomStorageStrategy` impl.** *Rejected* — forces every engine to re-implement
  version+migrate (the native `onupgradeneeded` path is per-engine and would not cover the localStorage
  floor uniformly); violates decouple/DRY. Native intrinsic versioning is an *implementation that can
  satisfy* the facet, not the standard's shape.

## Fork 3 — Granularity + envelope (RESOLVED → configurable dimension)

*Outcome:* both per-store and per-key are coherent end-states for different store topologies, so this
dissolved from a single-default fork into a **developer-configurable dimension defaulting to per-key**
(see *Ruling*). The branches below are retained as the design rationale for that default.

- **A — per-store version, single sidecar record** *(retained as the per-store opt-in)*. One integer for the whole persisted scope, mirroring the overwhelming prior
  art: native IndexedDB DB `version`, redux-persist `_persist.version`, Zustand `version`, SW cache names.
  Bumping the scope version re-evaluates every key in it. Simpler bookkeeping; aligns with the platform.
- **B — per-key `{v,data}` envelope**. Each persisted shape is self-describing and evolves independently —
  which is exactly the #487 footgun (loose, independently-renamed `localStorage` keys with no "store"
  abstraction). Atomic (version + data written together; cannot desync), but more bookkeeping and diverges
  from native.
- **The divergence:** the prior art says per-store; the concrete motivating bug is per-key. A per-store
  version *does* fix #487 (bump the scope version → all keys discarded/migrated), so A is defensible — but
  this is where judgment is genuinely needed, not a nod. Sidecar-vs-envelope is coupled to this: A implies
  a single sidecar version record per scope; B implies an inline envelope per key.

## Supported by default (not forks — both branches supported, default recorded)

- **Detection mechanism.** Support both a **version stamp** *(default)* and structural re-validation
  (`safeParse`-style) as an author opt-in for stores that prefer structure-as-contract.
- **Mismatch policy.** Always support both a registered **migration** and **discard**; the default when no
  migration path exists is **discard→defaults** (most-resilient / most-flexible default — never render
  stale-shaped state; migration is the author's opt-in).
- **Lazy read-time application** + a **degraded-but-working guarantee**, tied to the existing
  IndexedDB→localStorage degradation in #1108.

## Related

- webstates storage protocol #503, `StoragePersistence`/`CustomStorageStrategy` contract #1106,
  `CustomStorageStrategyRegistry` + degradation #1108
- Successor build (this decision's agent-ready outcome): **#1295** — webstates: build the client-storage
  schema-versioning facet (per-key envelope default).
- Origin: the #487 single-kind-axis migration's stale-filter-state break.
- Research: [Client Storage Schema Versioning & Migration](/research/client-storage-schema-versioning/);
  report `we:reports/2026-06-20-client-storage-schema-versioning.md`.
