---
kind: decision
size: 2
parent: "479"
status: parked
dateOpened: "2026-06-15"
tags: []
---

# Placement of the live edge serve runtime — plateau-app product vs WE reference demo

De-buried from #479's body (the live-serve placement fork). **Where does the live edge serve runtime live, and does the WE repo take the HTTP-server + bundler deps?** `EdgeChunkCache.serve` today returns a `Resolution`, not bytes ([we:edge.ts:169](../capabilities/edge.ts#L169)); standing up the runtime that actually bundles + serves real module bytes at `componentUrl` over HTTP collides with two standing positions — the open-core *defer-live-serve* operational ranking (monetization stance: self-run tooling over a hosted service) and constellation *no-leakage* layering (a served product decomposes to plateau-app, not the WE standard).

## Fork

- **A (bold default) — live-serve is a plateau-app product surface; WE ships only the contract + a pure-logic "emit plan."** WE's `EdgeChunkCache` gains a deterministic *build-plan* output (what to bundle, the cache key, the headers) with **no** HTTP server or bundler dep; plateau-app (or a thin demo) consumes that plan to bundle + serve. Honours defer-live-serve + layering; keeps WE dependency-light. **Recommended.**
- **B — WE hosts a reference edge server + bundler (esbuild) in-repo as a dogfood demo.** Faster to a visible end-to-end DoD, but pulls a server + bundler into the standard repo and pre-empts the defer-live-serve stance. Defensible only if framed strictly as a throwaway demo, not a product.

Both branches satisfy #479's DoD *behaviour* (built chunk keyed by capability class, shared across a class, degrades on a wrong guess); they differ on **where the bytes are built/served**.

**Status: `parked`** — the defer-live-serve stance defers *when* this is ratified (decide near a real MaaS-distribution surface, #087/#088), not *whether* the fork is tracked. Resolving it unblocks the live-serve build slices of epic #479 (under A: a WE emit-build-plan slice + a plateau-app serve-consumer slice).
