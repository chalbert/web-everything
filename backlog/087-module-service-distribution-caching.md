---
type: idea
status: open
dateOpened: "2026-06-06"
tags: [module-as-a-service, caching, distribution, cdn, eager-lazy, self-hosted, edge, immutability, adapters, plateau, esm]
relatedProject: webadapters
crossRef: { url: /adapters/, label: Rendering Adapters }
---

# Module-as-a-Service distribution — cache-friendly, eager *and* lazy, self-hosted *and* CDN-served

Module-as-a-Service (#081) can resolve and serve a component in any form over HTTP, but it serves **one artifact, on demand, from one origin, uncached**. This item extends MaaS into a real **distribution layer**: served artifacts are cache-friendly by construction, they can be delivered **eagerly** (pre-built and pushed to the edge) *or* **lazily** (resolved on first request, then cached), and the same service can run **self-hosted** by a consumer *or* behind a **CDN-like hosted service** (the open question of whether that hosted tier is free, paid, or both). It is the delivery hardening called out in #081's "production runtime delivery" follow-on — turning the walking skeleton into something an app depends on in production.

This item is **downstream of versioning (#088)**: cache-friendliness and eager distribution are only sound if a served artifact has a stable, immutable identity. You cannot mark a URL `immutable` or pre-push it to edges if its bytes can silently change. #088 supplies the content-addressed identity; this item builds the cache + distribution machinery on top of it.

## The three axes this item must reconcile

| Axis | Today (#081 phase 2a) | What distribution adds | Tension to resolve |
|---|---|---|---|
| **Cache-friendliness** | every request re-runs `serve()`; no cache headers | immutable content-addressed URLs (#088) → `Cache-Control: immutable`, long-lived; ETag/SRI for integrity; lossy/diagnostic carried in headers | a *floating* pin (`@latest`) must stay revalidatable while the resolved hash is immutable — two cache policies on the same logical component |
| **Eager vs. lazy** | purely lazy — resolved on the first (every) request | **eager:** pre-resolve the artifact matrix at publish time, warm the edge; **lazy:** resolve on first miss, then cache-fill | which slice of the `(form × target × strategy × version)` matrix is worth pre-building vs. left on-demand — eager-everything is combinatorial, lazy-everything has cold-start cost |
| **Self-hosted vs. hosted service** | the Vite plugin (`/_maas/*`) is dev-only, single origin | **self-hosted:** the same resolver as a deployable origin a consumer runs; **hosted:** a CDN-like service that resolves+caches+fans-out globally | one codebase, two deploy shapes; what (if anything) the hosted tier adds beyond a CDN in front of the self-hosted core; **free vs. paid** for the hosted tier |

## Open decisions (recommendations in bold)

- **Cache key & headers.** **Key the cache on the content-addressed id from #088; serve resolved artifacts with `Cache-Control: public, max-age=31536000, immutable` + an ETag/SRI hash; serve floating pins (`@latest`, ranges) as short-TTL redirects to the immutable URL.** Standard "immutable build, mutable pointer" CDN pattern — the pointer revalidates cheaply, the artifact never does.
- **Eager/lazy policy.** **Make distribution mode a per-artifact policy, default lazy-with-cache-fill, opt into eager for a declared "hot set."** Pre-building the full matrix is combinatorial and mostly wasted; let the author/consumer mark the forms+targets they actually ship (e.g. `wc-class@es2020` for prod, `declarative` for docs) and eager-warm only those. **Log what was left lazy** so coverage is never silently partial.
- **Self-hosted core.** **Factor the resolver + cache + delivery into a deployable origin that does not depend on Vite/11ty** (today's plugin is dev-only). The self-hosted shape is the canonical one; the hosted service is "this core + a CDN + a registry in front." Mirrors #081's "don't reinvent the wheel" — lean on standard CDN/edge infra, don't build a bespoke cache.
- **Hosted-tier shape & pricing.** **Open — flag for product decision, do not bake in.** A CDN-like hosted service could be: (a) **free** for public/open components (a public registry, like a Skypack/esm.sh for WE standard components); (b) **paid** for private components, SLAs, custom domains, or analytics; (c) **both** — free public tier, paid private/pro tier. Recommendation to *explore first*: **free public + paid private**, since the public tier doubles as adoption/distribution for the standard itself. This needs a real product owner; capture it, don't decide it here.
- **Integrity on native import.** **Emit SRI hashes so a native `import` (or import-map entry) can be integrity-pinned** — the content-addressed id (#088) makes this free, and it closes the "served bytes are what you think they are" gap for the no-build consumer (#081 phase 2a/2c).
- **Invalidation.** **Floating pointers are the only mutable thing; invalidation = re-point the tag, never purge an immutable artifact.** Immutable URLs are never invalidated (that's the point); only the short-TTL pointer flips, so edge purge is bounded and cheap.

## Dependencies / sequencing

1. **Versioning (#088)** — supplies the immutable content-addressed identity every cache/eager-distribution decision here depends on. **Blocks the cache contract.**
2. **MaaS phase 2a delivery** (#081) — the HTTP serve path this hardens. **Done.**
3. **This item, phased:** (a) cache headers + ETag/SRI on the existing origin; (b) self-hosted deployable core (de-Vite the resolver); (c) eager "hot set" pre-warming; (d) hosted CDN-like service + registry (and the free/paid product call).

## Notes

- This is the concrete build-out of #081's "Real resolver/registry," "Production runtime delivery," and "Home decision" follow-ons — distribution is where MaaS either stays a `webadapters` demo or graduates to a Plateau-side service with its own home.
- The hosted-service free/paid question is genuinely a **product** decision, not an engineering one; it is captured here as an open decision precisely so it isn't lost, not so it's settled by an agent.
