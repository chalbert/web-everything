---
type: idea
workItem: story
size: 5
parent: "203"
status: open
blockedBy: ["208"]
dateOpened: "2026-06-08"
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
