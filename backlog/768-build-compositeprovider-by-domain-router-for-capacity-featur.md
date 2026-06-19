---
type: issue
workItem: story
size: 3
status: resolved
blockedBy: ["767"]
dateOpened: "2026-06-16"
dateStarted: "2026-06-16"
dateResolved: "2026-06-16"
tags: []
---

# Build: CompositeProvider by-domain router for capacity/feature/network sources

Implements the ratified #729 Fork 3-A: a CompositeProvider holding a { domain -> provider } map that dispatches each query to its configured source (feature -> CapabilityProvider, capacity -> CapacityProvider, network -> edge), satisfying the same interface so the native-first resolver (we:capabilities/resolver.ts) and venue selection run unchanged. Routes by coarse domain (the enumerable registration unit), not per-id.

By-domain is non-restrictive: registering the same provider for every domain collapses to single-provider behaviour, so it adds a capability without an obligation. The B fallback-chain shape is a later additive nest inside a slot, not part of this build. Blocked by #767 (needs the sibling CapacityProvider to route to).

## Progress (2026-06-16, batch-2026-06-16) — built

- **Module:** [we:capabilities/composite.ts](../capabilities/composite.ts), exported via `we:capabilities/index.ts`.
- **`ByDomainRouter<Domain, P>`** — the generic, interface-agnostic `{ domain → provider }` map (the "one built thing" the #729 Fork 3-A ruling describes). `route(domain)`, `domains()`, `providers()` (deduped). Registering one provider under every domain collapses dispatch to that single provider — non-restrictive (most-flexible-default). Same mechanism instantiates over `CapabilityProvider` (feature domain — single matrix today, so no composite forced) or `CapacityProvider`.
- **`CompositeCapacityProvider implements CapacityProvider`** — routes each dimension to its domain's source via `CAPACITY_DIMENSION_DOMAIN` (`compute` → native #767, `gpu` → #769, `network` → edge). Implements the **same interface**, so venue selection / capacity consumers run unchanged. An unconfigured domain reads **unknown** (degrade contract, no throw); `adapters()` unions+dedupes; `isNative()` ORs the slots.
- **Coarse domain, not per-id** (#729 Fork 3-A): three domains each with a single source today, so **no 3-B fallback/merge needed** — that nests inside a slot later, additively (#729: B composes with A). `createCompositeCapacityProvider({navigator, hints, gpuProbe})` wires the default + returns the GPU `ready`.
- **Tests:** [we:capabilities/__tests__/composite.test.ts](../capabilities/__tests__/composite.test.ts) — 7 cases (router dispatch + collapse, per-domain routing, unknown-degrade, readAll/adapters/isNative). Full capabilities suite 135/135.
- **Verified:** vitest 7/7 (+135/135 suite), capabilities/ typechecks clean, `check:standards` green.
