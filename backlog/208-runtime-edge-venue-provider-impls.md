---
type: idea
workItem: story
size: 8
parent: "203"
status: resolved
dateOpened: "2026-06-08"
blockedBy: ["204", "205"]
dateStarted: "2026-06-08"
dateResolved: "2026-06-08"
graduatedTo: "capabilities/venues.ts (Venue + degrade + DegradingProvider) + runtime.ts + edge.ts"
tags: [capability-provider, venue, runtime, edge, module-as-a-service, client-hints, caching, progressive-enhancement]
crossRef: { url: /backlog/203-capability-provider-resolution-architecture/, label: "Runtime + edge venue impls of epic #203" }
---

# Runtime + edge venue provider impls

The non-default venue implementations of the capability provider interface
([#204](/backlog/204-capability-vocabulary-provider-interface-matrix/) ships the `build`-venue static
matrix). Per the **D4′** ruling and the #203 venue dimension. This is the story that wires the
capability provider into the **module-as-a-service** thread
([#087](/backlog/087-module-service-distribution-caching/),
[#088](/backlog/088-module-service-versioning/),
[#085](/backlog/085-validation-adapters-multi-language/)) — it is their missing resolution layer.

## Scope

- **Runtime feature-detection impl** — implements `tier(impl, capabilityId)` by testing the **actual
  UA** at runtime (`CSS.supports`, `'popover' in HTMLElement.prototype`, etc.) rather than reading the
  static matrix. Most accurate; for the `runtime` venue (unknown targets, no infra). Where a capability
  isn't runtime-detectable, fall back to the static matrix.
- **Edge-service impl** — for the `edge` module-as-a-service venue (broad targets, smallest payload,
  cached):
  - Capabilities ride in the component URL (`/c/droplist@1?caps=…`) using #204's URL-serializable
    capability IDs.
  - Client signal read **server-side via Client Hints, _not_ UA sniffing**.
  - Chunk **cached per capability-equivalence class** (not raw UA) — two clients with the same resolved
    capability set share a chunk.
  - Kept **progressive-enhancement**: a wrong guess degrades rather than breaks.
- **Venue selection** — the venue is the configurable dimension from #203 (default `build`), settable in
  the base definition and overridable per project; this story makes `runtime` and `edge` selectable and
  routes to the right impl. Same eligible-tiebreak resolver (#205) runs in all venues; only where/when
  differs.
- **DoD** — runtime venue resolves a droplist against the live UA; edge venue serves a capability-keyed
  chunk cached per equivalence class with a Client-Hints signal; both degrade gracefully on a wrong
  guess. Cross-link the module-as-a-service items. `check:standards` green.

## Note

This is the largest child and depends on the foundation (#204) + resolver (#205). Edge infra may
warrant its own follow-up if it grows beyond a demonstrable POC — keep it progressive-enhancement and
demonstrable first per POC pragmatism.

## Progress

- **Status:** resolved (2026-06-08)
- **Branch:** docs/standard-authoring-workflow
- **Done:**
  - **Venue dimension + shared `degrade` primitive** — [capabilities/venues.ts](../capabilities/venues.ts):
    `Venue` (`build` default) + `VENUES`; `degrade(architecturalTier, support, polyfillClass)` lowers a
    static-matrix ceiling by live platform reality (native-ok → polyfill-ok, or → capability-hard for
    `capability`-class features; `undefined` support → fall back to the matrix; only ever lowers, never
    promotes); `DegradingProvider` overrides only `tier()` and defers all structure to a base provider;
    `providerForVenue` routing + `resolveAtVenue` (proves the **unchanged #205 resolver** runs in every venue).
  - **Runtime feature-detection venue** — [capabilities/runtime.ts](../capabilities/runtime.ts):
    `BROWSER_DETECTORS` (13/14 caps; `cross-root-aria` deliberately undetectable → matrix fallback),
    `browserFeatureSupport` (injectable for deterministic tests), `createRuntimeProvider`.
  - **Edge module-as-a-service venue** — [capabilities/edge.ts](../capabilities/edge.ts): `ClientHints`
    declared-profile (server-side, **not** UA sniffing) → `clientHintsSupport`; `equivalenceClass` (keys on
    the supported subset of requested caps, not the raw UA); `componentUrl` (`/c/droplist@1?caps=…`,
    URL-serializable ids); `EdgeChunkCache` (one chunk per equivalence class, shared across UAs);
    `createEdgeProvider`. Wired defaults in [capabilities/index.ts](../capabilities/index.ts).
  - **Tests** — 32 new (venues 15 / runtime 7 / edge 10): the `degrade` truth table, venue routing,
    feature-detection tiering + matrix fallback, equivalence-class cache sharing, the URL, and
    PE-degradation on a wrong guess (DoD).
  - **Catalog** — `/capabilities/` gains a *Resolution venues* section (build/runtime/edge + the `degrade`
    PE story) and **cross-links the module-as-a-service items** (#087/#088/#085).
- **Next:** _(resolved)_ Follow-ups filed: #219 (productionize edge — real Client-Hints headers +
  build-time chunk emission), #220 (wire `venue` as an authored base/project config field).
- **Notes:** Gates green — full vitest **1753 pass / 7 skip** (was 1721 + 32 new), `check:standards`
  **0 errors** (212 backlog items), `/capabilities/` **200** on :8080 and :3000. The 38 pre-existing tsc
  errors are all in `src/cases/webinjectors/*` (unrelated); the capability files are clean. Both venue
  impls are one `DegradingProvider` mechanism over two support sources (live detection vs. Client Hints),
  satisfying the existing `CapabilityProvider` interface — the resolver, strictness, and cascade are unchanged.
