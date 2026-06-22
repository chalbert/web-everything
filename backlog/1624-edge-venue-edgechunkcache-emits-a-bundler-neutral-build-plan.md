---
kind: story
size: 3
parent: "479"
status: open
dateOpened: "2026-06-22"
tags: []
---

# Edge venue — EdgeChunkCache emits a bundler-neutral build-plan (+ we:capabilities/check.ts neutrality vector)

WE-side slice of #479, ratified by #699(a). Add a deterministic emit-build-plan output to we:capabilities/edge.ts EdgeChunkCache: capability-class, cache-key, and declarative Vary/Accept-CH/immutable response-header directives — with NO HTTP server and NO bundler (esbuild) dependency. A WE-side we:capabilities/check.ts conformance vector pins the plan bundler-neutral (zero esbuild/chunk-naming fields) so delivery impl cannot creep into the standard repo. Pure contract logic, agent-doable; the contract WE emits for a downstream serve-consumer (the deferred plateau slice) to bundle + serve. Honours constellation-placement + defer-live-serve.

## Scope

- Today [`we:capabilities/edge.ts`](../capabilities/edge.ts#L160)'s `EdgeChunkCache` resolve returns a `Resolution` (url + equivalence class + cache key + chunk) — a *plan*, not bytes. Extend it with an explicit, deterministic **emit-build-plan**: the capability-class, the cache key, and the response-header directives a consumer must apply.
- **Headers are declarative + web-standard only:** `Vary`, `Accept-CH`/`Critical-CH`, and immutable-cache directives — the `caps`-keyed `componentUrl` ([`we:capabilities/edge.ts:88`](../capabilities/edge.ts#L88)) carries the cache dimension. **No** `esbuild`/chunk-naming/bundler fields.
- **No HTTP server, no bundler dependency** enters the WE repo. The plan is bundler-neutral data; a downstream consumer ([#1625](/backlog/1625-edge-venue-live-serve-plateau-app-consumes-the-we-emit-build/), plateau-app) bundles + serves.

## Bundler-neutrality vector (the #699 amendment)

- Add a [`we:capabilities/check.ts`](../capabilities/check.ts) conformance vector asserting the emit-build-plan exposes **only** capability-class + cache-key + the declarative header set, and contains **zero** esbuild/chunk-naming/delivery-impl fields. This is the enforceable guard that delivery coupling cannot creep into the standard repo.
- This vector is conformance *tooling a WE-side `we:capabilities/check.ts` gate consumes* — the one runtime-ish thing that legitimately stays WE under the [constellation-placement](docs/agent/platform-decisions.md#constellation-placement) carve-out.

## Lineage

- Placement + neutrality amendment ratified by [#699](/backlog/699-placement-of-the-live-edge-serve-runtime-plateau-app-product/) (option **a**). Consumer slice: [#1625](/backlog/1625-edge-venue-live-serve-plateau-app-consumes-the-we-emit-build/).
