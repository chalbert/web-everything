---
type: decision
workItem: story
size: 5
status: open
dateOpened: "2026-06-16"
tags: [capabilities, provider-seam, device-capacity, client-hints, composite, delegation]
---

# Capacity provider: device-resource detection axis + composite multi-source routing

The capability provider seam (epic #203, children #204–#208) is swappable and delegation-based, but
it models **platform feature capability** (Baseline/web-features: dialog, popover, anchor-positioning)
and selects **one** provider per scope by venue. Two things it does NOT yet do: (1) expose a
**device-capacity** axis — `hardwareConcurrency`, `deviceMemory`, network/`saveData`, battery, GPU /
device tier — as a registered provider alongside the feature one; (2) **combine multiple providers**
so different checks route to different sources. Decide whether/how to add both, delegating the actual
detection to existing solutions rather than building/maintaining it in-house.

## Context — what already exists

- `CapabilityProvider` interface — [capabilities/provider.ts:73](../capabilities/provider.ts#L73)
  (`tier()`, `requiredCapabilities()`, `impls()`). Injectable, swappable.
- Venue-selected impls — [capabilities/venues.ts:38](../capabilities/venues.ts#L38)
  (`type Venue = 'build' | 'runtime' | 'edge'`), one chosen via
  [`providerForVenue`](../capabilities/venues.ts#L150). `build` = static matrix, `runtime` = live
  feature detection, `edge` = Client-Hints header parsing (#219, [capabilities/edge-io.ts](../capabilities/edge-io.ts)).
- Detection is already **delegated** to the platform (browser APIs, `Sec-CH-UA-*`) — not maintained
  in-house. This item keeps that property.
- Scope cascade — [capabilities/cascade.ts](../capabilities/cascade.ts) — scopes *bindings*
  (base → app → view → fragment), it does NOT multiplex *sources*.

Both gaps share one design: a provider can answer for a **domain of checks**, and you want to pick a
different provider per domain. So this is really one decision with two surfaced forks.

## Fork A — where the device-capacity axis lives (vocabulary + provider)

Device signals (`navigator.hardwareConcurrency`, `navigator.deviceMemory`, `navigator.connection`,
`getBattery()`, GPU/device-tier) are categorically different from web-features tiers (they're scalar
runtime measurements, not native/polyfill/hard tiers). Options:

- **A1 (default) — separate `CapacityProvider` contract, same registration pattern.** A sibling to
  `CapabilityProvider` keyed by capacity dimension → measured value/bucket, registered the same way
  (#206 table), delegating to an existing lib for the read. Keeps the feature-tier semantics clean
  (an impl is not a standard, and bias toward separation: burden of proof is on combining; two
  scalar/tier semantics → two contracts).
- A2 — overload the existing `CapabilityProvider` with new capability IDs for device signals. One
  registry, but conflates measured scalars with feature tiers; the `Tier` union (#204) doesn't fit
  `deviceMemory: 8`.

## Fork B — how multiple providers combine (the "combine for different checks" ask)

- **B1 (default) — a `CompositeProvider` that routes by check domain.** A provider that holds a map of
  `{ domain → provider }` and dispatches each query to the configured source (feature → runtime,
  device-tier → Client-Hints/edge, network → external lib), satisfying the SAME interface so the
  `native-first` resolver ([capabilities/resolver.ts](../capabilities/resolver.ts)) and venue
  selection run unchanged. Deterministic, declarative routing table.
- B2 — chain/fallback composition (try provider 1, fall through to provider 2 on "unknown"). Useful
  for graceful degradation but answers a different need (redundancy, not per-check routing); could be
  a follow-up, not the primary mechanic (per the dimension-vs-fixed-mechanic principle: expose as a
  configurable axis only if both branches are legitimate end-states).
- B3 — leave selection single-provider-per-scope (status quo); reject the compose ask. Rejected unless
  B1/B2 prove unnecessary — the user explicitly wants per-check routing.

## Delegation constraint (non-negotiable)

Per the user's framing and the native-first / minimize-lock-in principles:
WE does NOT build/maintain detection. The provider impls are thin adapters over existing solutions
(browser APIs, Client-Hints, a maintained device-tier/network lib). What WE standardizes is the
**provider contract + composite routing**, not the detection algorithm. Survey candidate libs as part
of preparing this decision.

## Relationship to prior work

Extends epic #203's provider-resolution architecture rather than forking a parallel one — same
interface, same resolver, same registration table (#206). Not an epic, not a conflation
(no decision+epic conflation): this is the design decision; the build (vocabulary rows +
`CapacityProvider`/`CompositeProvider` impls + lib selection) is separately-prioritized follow-up once
the forks are ratified.
