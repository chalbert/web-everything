---
type: decision
workItem: story
size: 5
status: resolved
dateOpened: "2026-06-16"
dateStarted: "2026-06-16"
dateResolved: "2026-06-16"
graduatedTo: none
codifiedIn: "one-off"
preparedDate: "2026-06-15"
relatedReport: reports/2026-06-15-device-capacity-provider.md
tags: [capabilities, provider-seam, device-capacity, client-hints, composite, delegation]
---

# Capacity provider: device-resource detection axis + composite multi-source routing

**Prepared — ready to ratify.** No new design exists yet; the **three** forks below are grounded in a
prior-art survey published as the [`device-capacity-provider`](/research/device-capacity-provider/)
research topic (session report `we:reports/2026-06-15-device-capacity-provider.md`). Each fork carries a
**bold** recommended default; the glance table says where judgment is actually needed. The survey
**reshaped** the original framing — it added Fork 2 (the scalar-vs-bucket output shape) and excluded
battery as a broken branch rather than an option.

The decision extends the capability-provider epic [#203](/backlog/203-capability-resolution-architecture/)
rather than forking a parallel architecture: same injectable contract, same `native-first` resolver,
same `Venue` dimension, same registration table (#206). The **build** (vocabulary rows +
`CapacityProvider` / `CompositeProvider` impls + the one `detect-gpu` dependency) is a
separately-prioritized follow-up once the forks are ratified — not part of this call.

## The axis-framing

The concern decomposes into three orthogonal axes, each pinned to the real tree:

1. **Where the device-capacity axis lives** — capacity signals (`navigator.hardwareConcurrency`,
   `navigator.deviceMemory`, `navigator.connection.*`, GPU tier) are *scalar runtime measurements*,
   categorically unlike the 3-state polyfill `Tier` union the feature provider uses
   ([`we:capabilities/provider.ts:20`](../capabilities/provider.ts#L20)). Do they get their own
   contract beside [`CapabilityProvider`](../capabilities/provider.ts#L73), or overload it?
2. **The output shape of a capacity read** — a raw scalar (`deviceMemory: 8`), a normalized coarse
   bucket (`device-tier: 'high'`), or both? The feature provider answers with a single `Tier`
   ([`we:provider.ts:75`](../capabilities/provider.ts#L75)); capacity has no equivalent settled shape,
   and the prior-art combinators all derive a bucket from a raw measurement.
3. **How multiple providers combine** — the resolver consults exactly one provider per scope today
   ([`we:venues.ts:150` `providerForVenue`](../capabilities/venues.ts#L150)); the user wants different
   check-domains to route to different sources (feature→runtime, capacity→GPU lib, network→edge).

The decisive survey finding tying these together: **signal availability is not uniform across venues.**
`hardwareConcurrency` and GPU-tier are runtime-only (no request header carries them), while
`deviceMemory` (`Sec-CH-Device-Memory`) and `Save-Data` also resolve at the **edge**. That is exactly
the `Venue` dimension the feature provider already models
([`we:venues.ts:38`](../capabilities/venues.ts#L38)) and the `undefined`-means-unknown degrade contract
([`we:venues.ts:51` `PlatformSupport`](../capabilities/venues.ts#L51)) — so the capacity axis should
**reuse** that machinery, which is itself an argument for a sibling provider over a parallel path.

**Detection locus is itself a flexible dimension — capacity reads can run *in* or *out of* the
browser, and WE forces neither.** This is the same `Venue` axis seen from the timing/accuracy side:
each locus enables a different set of features and carries its own limitation, so a project picks the
trade that fits (and the Fork-3 composite can mix them — cheap edge signals at delivery, richer
in-browser signals after load). The two coherent end-states (both supported by default, never
mandated):

| Locus | What it enables | Its limitation |
|---|---|---|
| **In-browser** (runtime feature detection / `detect-gpu` / `navigator.*`) | **Real** measured capacity — the full signal set incl. CPU cores + GPU tier; most accurate | **Performance** — detection must run *before/while* the app loads (GPU benchmark especially costly); a pre-load capacity gate or a two-pass "load, then refine" is the cost of accuracy |
| **Out-of-browser** (MaaS / edge — UA + Client Hints, server-decided) | **Zero runtime cost**, cached per equivalence class, decided *before* delivery (the #219 edge venue) | **Coarser & header-only** — sees just the signals that ride in headers (`deviceMemory`, `Save-Data`); no CPU/GPU; UA-based inference is approximate |

### Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **1 — where the capacity axis lives** | Separate `CapacityProvider` contract, same registration + venue machinery | Overload `CapabilityProvider` with capacity ids | High |
| **2 — capacity output shape** | Expose **both** raw scalar and a derived coarse bucket | Bucket-only (or scalar-only) | Med-high |
| **3 — how providers combine** | `CompositeProvider` routing by check-domain | Status quo (single provider per scope) | High |

## Supported by default (not decisions)

- **Delegation is non-negotiable** — WE never builds/maintains detection. Impls are thin adapters over
  native APIs + Client Hints + one maintained lib. Survey verdict: CPU/RAM/network are native reads,
  **GPU tier delegates to [`detect-gpu`](https://github.com/pmndrs/detect-gpu)** (pmndrs; the single
  axis warranting a dependency), battery is excluded. So the delegation constraint is met with **one**
  library — not itself a fork.
- **Battery is excluded as broken, not an option.** The Battery Status API is deprecated, removed by
  Firefox, never shipped by Safari, and a fingerprinting vector (~76% Chromium-only). Per the
  fork-existence test it is dropped with this reason, not weighed.
- **The vocabulary is the adaptive-loading set** — `hardwareConcurrency`, `deviceMemory`,
  `effectiveType`/`saveData`, GPU tier, borrowing official platform names (W3C Device Memory, Network
  Information API, the `Save-Data` / `Sec-CH-Device-Memory` Client Hints, `WEBGL_debug_renderer_info`).
  WE's capacity provider is the platform-neutral, framework-free form of Google's `react-adaptive-hooks`.

## Fork 1 — where the device-capacity axis lives

**Crux.** Device signals are scalar measurements; the feature provider's `Tier` union
([`we:provider.ts:20`](../capabilities/provider.ts#L20)) is a 3-state polyfillability class. A capacity
read (`deviceMemory: 8`) doesn't fit a feature tier. Do they share one registry or get two?

- **A — separate `CapacityProvider` contract, same registration pattern.** *(recommended)* A sibling
  to `CapabilityProvider` keyed by capacity dimension → measured value/bucket, registered the same way
  (the #206 adapter table) and resolved through the **same** `Venue` dimension + `PlatformSupport`
  degrade contract. Keeps the feature-tier semantics clean and honours the standing separation bias
  (two distinct value semantics → two contracts; *impl-is-not-a-standard* — the lib read is registered
  as a resolver impl, not as a new shape on the feature contract). Classification: layer = **Capability**;
  not a Protocol (DI-injectable provider seam, no multi-vendor wire format); DI-injectable = yes.
- B — overload the existing `CapabilityProvider` with new capability ids for device signals. One
  registry, but conflates measured scalars with feature tiers — the `tier()` method
  ([`we:provider.ts:75`](../capabilities/provider.ts#L75)) returns a `Tier`, which can't carry
  `deviceMemory: 8` without widening the union for every feature consumer. *Rejected* unless A's
  second contract proves to duplicate the first — the value semantics genuinely differ, so the burden
  of proof on combining is not met.

## Fork 2 — the output shape of a capacity read *(added by the survey)*

**Crux.** Capacity has no settled output shape the way features have `Tier`. The original framing only
glimpsed this via Fork 1's "the `Tier` union doesn't fit `deviceMemory: 8`" aside. Every prior-art
combinator (`detect-gpu`: fps → tier 0–3; Network Information: `downlink`/`rtt` → `effectiveType`)
keeps a raw measurement *and* derives a coarse bucket the call site actually consults.

- **A — expose both the raw scalar and a derived coarse bucket.** *(recommended)* `CapacityProvider`
  answers a dimension with its raw value (`deviceMemory: 8`, `cores: 8`) **and** a normalized bucket
  (`'high' | 'mid' | 'low'`, or the GPU `tier`). The raw value is the most-permissive output (Q6 —
  nothing is hidden); the bucket is the composable convenience adaptive-loading consumers want and the
  only shape that survives a venue with a bucketed-only source (`Sec-CH-Device-Memory` reports buckets,
  not exact RAM). Classification: dimension exposed in full (Q3), default = most-permissive (Q6).
- B — bucket-only (or scalar-only). Bucket-only discards information a consumer may want
  (`hardwareConcurrency` for a worker-pool size); scalar-only forces every consumer to re-derive a
  threshold and can't represent a bucketed-only edge source. *Rejected* — collapsing the axis to one
  value loses a legitimate end-state on each side; exposing both costs only the derivation function.

## Fork 3 — how multiple providers combine

**Crux.** `providerForVenue` ([`we:venues.ts:150`](../capabilities/venues.ts#L150)) returns exactly one
provider per scope; the user wants per-check routing (feature checks → runtime feature-detection,
capacity → the GPU lib, network → edge `Save-Data`).

**The actual fork is A vs C — whether to add per-check routing at all.** (B below is *not* a third
branch on this ballot; it composes with whichever wins. See "Not a branch" after the options.)

- **A — a `CompositeProvider` that routes by check-domain.** *(recommended)* A provider holding a
  `{ domain → provider }` map that dispatches each query to its configured source, satisfying the
  **same** interface so the `native-first` resolver ([`we:resolver.ts:180`](../capabilities/resolver.ts#L180))
  and venue selection run unchanged. Deterministic, declarative routing table; composes cleanly with
  Fork 1's sibling provider (feature domain → `CapabilityProvider`, capacity domain → `CapacityProvider`).
  *Sub-decision:* route by **coarse domain** (feature / capacity / network as the registration unit)
  rather than per-id — the natural, enumerable granularity; default **by-domain**.
- C — leave selection single-provider-per-scope (status quo). *Rejected* — denies the explicit ask for
  per-check routing; the broken branch only if the user wanted nothing here, which is not the case.

**Not a branch — B (chain/fallback) composes with A; it is not selected *against* A.** B is a
fallback chain (try provider 1, fall through on "unknown"). It answers a *different* need
(redundancy/graceful degradation, not per-check routing), so it **nests inside** A rather than rivalling
it: A is always the outer router, and any one slot of A's `{ domain → provider }` map can hold a B
fallback chain as its provider (e.g. `capacity → [edgeProvider, then CapacityProvider]`). The composite
calls that slot's provider unchanged. So ratifying A ships **exactly one** built thing (the router);
B is a **supported, additive follow-up** — not built now, becoming worth building the first time a real
domain needs fallback. It is listed here only to record that "we might want fallback later" is **not** a
reason to reject the simple by-domain map now.
  - *Considered & set aside as the primary router: a `canDetect(dimension)` predicate on each provider*
    (the chain-of-responsibility / capability-introspection shape; idiomatic here — `isNative(impl)`
    at [`we:provider.ts:86`](../capabilities/provider.ts#L86) is already a `can*` predicate). It looks
    like a more granular alternative to the by-domain map, but it is **not a rival to 3-A** — it is a
    *spelling of this 3-B fallback chain* (ask each provider in turn, first that claims the dimension
    wins), not a routing-granularity choice. Two reasons it doesn't displace the by-domain map as the
    primary mechanic: **(1)** the case it would buy — non-uniform signal availability across venues
    (edge answers `deviceMemory` but not `cores`/GPU) — is *already* covered by the orthogonal
    `undefined`-means-unknown / `PlatformSupport` degrade contract ([`we:venues.ts:51`](../capabilities/venues.ts#L51)):
    by-domain decides *ownership*, the degrade contract decides *availability in this venue*, and
    folding them into one predicate conflates two axes. **(2)** A by-domain map is statically
    inspectable (read one line → know the source) and unambiguous by construction; `canDetect` makes
    routing runtime-resolved and needs a precedence rule when two providers both claim a dimension.
    Where it **does** earn a place: as the fallthrough predicate *inside* a 3-B fallback chain it is
    cleaner than catching on `undefined` — an implementation detail of this additive follow-up, not a
    change to the 3-A primary mechanic.

## Decision — ratified 2026-06-16

All three forks ratified at their recommended defaults; the rulings compose (A+A+A).

- **Fork 1 → A.** A separate `CapacityProvider` contract, sibling to `CapabilityProvider`, reusing the
  same #206 registration table, `Venue` dimension, and `PlatformSupport` degrade contract. Measured
  scalars and feature tiers keep distinct value semantics → distinct contracts; the lib read registers
  as a resolver impl (*impl-is-not-a-standard*), not as a new shape on the feature contract.
- **Fork 2 → A.** A capacity read exposes **both** the raw scalar (`deviceMemory: 8`, `cores: 8`) and a
  derived coarse bucket (`'high' | 'mid' | 'low'`, or the GPU `tier`). Most-permissive output (nothing
  hidden) and the only shape that survives a bucketed-only edge source (`Sec-CH-Device-Memory`).
- **Fork 3 → A, by-domain.** A `CompositeProvider` routes by coarse check-domain via a
  `{ domain → provider }` map, satisfying the same interface so resolver + venue selection run
  unchanged. B (fallback chain) is **not** rejected — it nests inside a slot of A's map as an additive
  follow-up, built only when a domain needs fallback.
  - **By-domain is non-restrictive, not a separation mandate** *(ratification note).* The map does not
    *force* splitting sources across domains — the **same** provider may be registered for every
    domain, which collapses the composite straight back to single-provider behaviour. So the worst case
    of "I don't actually want per-domain sources" costs nothing: register one provider everywhere. The
    by-domain map is a *capability* a project opts into per-domain, never an obligation.

The build is a separately-prioritized follow-up, gated on this ruling via a `blockedBy` chain (see the
spin-off items below). No entity exists yet, so this decision graduates to `none`; the spin-off builds
graduate to the `CapacityProvider` / `CompositeProvider` entities when implemented.

## Context — relationship to prior work

Extends epic [#203](/backlog/203-capability-resolution-architecture/)'s provider-resolution
architecture (children #204–#208) — same interface, same resolver, same `Venue` dimension, same #206
registration table. Not an epic, not a decision+epic conflation: this is the design decision; the build
(vocabulary rows + `CapacityProvider`/`CompositeProvider` impls + the `detect-gpu` dependency) is a
separately-prioritized follow-up gated on these forks being ratified. At resolution each fork gains a
dated ruling and the item graduates to spin-off builds via a `blockedBy` chain.
