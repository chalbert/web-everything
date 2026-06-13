---
type: idea
workItem: story
size: 5
status: resolved
blockedBy: ["208"]
dateOpened: "2026-06-08"
dateStarted: "2026-06-13"
dateResolved: "2026-06-13"
graduatedTo: capabilities/edge-io.ts (I/O + caching shell; live serving → #479)
tags: [capability-provider, venue, edge, module-as-a-service, client-hints, caching, productionize]
crossRef: { url: /backlog/208-runtime-edge-venue-provider-impls/, label: "Productionizes the edge POC from #208" }
---

# Edge venue — real Client-Hints header parsing + build-time chunk emission

[#208](/backlog/208-runtime-edge-venue-provider-impls/) shipped the edge venue as a **demonstrable
POC** (per the POC-pragmatism note on that item): `ClientHints` is a *declared* capability/baseline
profile, the equivalence-class cache is in-memory, and resolution runs in a unit test. This story
productionizes it into a real edge service.

## Scope

- **Real Client-Hints header parsing** — map the actual request headers (`Sec-CH-UA`,
  `Sec-CH-UA-Platform`, `Sec-CH-UA-Full-Version-List`, `Sec-CH-UA-Mobile`) to the `ClientHints`
  declared-profile shape `clientHintsSupport()` already consumes — and advertise them via
  `Accept-CH` / `Critical-CH`. This is the boundary `capabilities/edge.ts` deliberately stubbed: the
  POC takes the resolved profile; production has to *derive* it from headers server-side (still **not**
  UA sniffing — use the structured hints).
- **Build-time / edge chunk emission** — wire `EdgeChunkCache` to actually emit and serve the resolved
  component chunk at the `componentUrl` (`/c/droplist@1?caps=…`), cached per capability-equivalence
  class with appropriate `Cache-Control` + `Vary`. The cache key is the equivalence class (already
  computed); this story makes the chunk real (a built module), not just a `Resolution` object.
- **Map version → Baseline support** — the POC's `baselineYear` heuristic is a stand-in. Back it with a
  real `web-features` / Baseline lookup so a parsed UA version resolves to an honest supported-capability
  set.
- **DoD** — a request with real Client-Hints headers resolves a droplist to a capability-keyed chunk
  served from the edge cache; two distinct UAs in the same equivalence class share a chunk; a wrong
  guess degrades (progressive enhancement). Ties into the module-as-a-service thread
  ([#087](/backlog/087-module-service-distribution-caching/),
  [#088](/backlog/088-module-service-versioning/)). `check:standards` green.

## Note

Keep it progressive-enhancement throughout — a missing/spoofed hint must degrade, never break. The
provider, resolver, equivalence-class key, and URL are all done in #208; this is the I/O + caching
shell around them.

## Progress

Delivered the **I/O + caching shell** (the item's own framing) as a pure, dependency-free module
[capabilities/edge-io.ts](../capabilities/edge-io.ts) + [test](../capabilities/__tests__/edge-io.test.ts)
(9 cases; full capabilities suite 97/97, tsc clean, check:standards green) — 2026-06-13:

- **Real Client-Hints parsing** — `parseBrandList` reads the Structured-Headers brand list and drops
  GREASE; `parseClientHints(headers, opts?)` maps `Sec-CH-UA-Full-Version-List` (fallback `Sec-CH-UA`) +
  `Sec-CH-UA-Platform`/`-Mobile` onto the `ClientHints` declared profile `clientHintsSupport()` already
  consumes. Accepts a real `Headers` or a plain object (case-insensitive). **Never sniffs a UA.** Proven
  end-to-end driving `clientHintsSupport`.
- **Hint advertisement** — `ACCEPT_CH` + `negotiationHeaders()` emit `Accept-CH` / `Critical-CH` / `Vary`
  for the entry response so the browser sends the hints on first navigation.
- **Cache directives** — `chunkCacheHeaders()` makes a served chunk `immutable` (content-addressed by its
  `caps` query, #204/#088), with **no hint `Vary`** (the capability set is already the URL/cache key); the
  hint-varying lives on the negotiation response, not the chunk.
- **Baseline mapping kept honest** — version → Baseline epoch is an **injected** `BaselineLookup`, not
  invented inline; absent a lookup `baselineYear` is left undefined (the parser never fabricates support).

**Carved to [#479](479-edge-venue-live-build-time-chunk-emission-web-features-backe.md)** (blockedBy this) —
the two pieces that need infra absent from this pure-logic package: a real `web-features`-backed
`BaselineLookup` (the package isn't installed) and the **live edge runtime** that actually bundles + serves
a built module at `componentUrl` over HTTP (today `EdgeChunkCache` returns a `Resolution`, not bytes —
needs a server + bundler). The DoD's "served real chunk" completes there.
