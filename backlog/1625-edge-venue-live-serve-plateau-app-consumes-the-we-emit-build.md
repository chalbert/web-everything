---
kind: story
size: 3
status: parked
parkedReason: maturityGated
maturityTrigger: "adoptionSignal: a real MaaS-distribution surface (the #087/#088 design) goes live and forces live serving (#479 resolved 2026-06-23 deferring live-serve until exactly this)"
locus: plateau-app
dateOpened: "2026-06-22"
tags: []
---

# Edge venue live-serve — plateau-app consumes the WE emit-build-plan to bundle + serve chunk bytes

plateau-app product slice, lineage #479/#699(a). Consume WE's bundler-neutral emit-build-plan (#1624) in plateau-app to bundle real module bytes and serve them at we:capabilities/edge.ts componentUrl over HTTP — the served, credential-holding live-serve runtime the constellation-placement statute routes to Plateau (never the WE repo). This is the actual delivery runtime (HTTP server + bundler) that #699 ruled lives here. Deferred by the open-core defer-live-serve stance until a real MaaS-distribution surface (#087/#088) makes live serving needed; blockedBy #1624 (needs the WE plan first). Homed in plateau-app via relatedProject.

## Scope

- Consume the deterministic build-plan emitted by [`we:capabilities/edge.ts`](../capabilities/edge.ts#L88)'s `EdgeChunkCache` (#1624): capability-class, cache-key, and the declarative `Vary`/`Accept-CH`/immutable header directives.
- Stand up the **delivery runtime in plateau-app** — an HTTP server + bundler (e.g. esbuild) that turns the neutral plan into real module bytes and serves them at `componentUrl` with the plan's headers. None of this lives in the WE repo (constellation-placement statute; #699 ruling).
- DoD inherits #479's behaviour bar: a request with real Client-Hints resolves a droplist to a capability-keyed **built** chunk served from the edge cache; two UAs in one class share the chunk; a wrong guess degrades.

## Lineage & gating

- Placement ratified by [#699](/backlog/699-placement-of-the-live-edge-serve-runtime-plateau-app-product/) (option **a**): WE ships only the contract + pure emit-plan; the served runtime is a plateau-app product.
- `blockedBy: #1624` — needs the WE-side emit-build-plan + its neutrality vector first.
- **Defer-live-serve:** this is the product surface the open-core stance defers. Un-park trigger: a real MaaS-distribution need surfacing on epic #479 (#087/#088 distribution surfaces). Until then it stays blocked, not prioritized.
