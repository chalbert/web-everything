# MaaS hosted-tier shape & pricing — economics & build-vs-ride (prep research for #451)

**Date:** 2026-06-13
**Backlog:** [#451](../backlog/451-maas-hosted-tier-shape-pricing-free-public-paid-private-both.md)
(decision, product) · gates **phase (d) only** of
[#087](../backlog/087-module-service-distribution-caching.md) (the hosted CDN-like service + registry)
**Cluster:** open-core monetization — [#089](../backlog/089-monetization-product-ideas.md),
[#091](../backlog/091-managed-offering-constellation-layering.md),
[#097](../backlog/097-roadmap-to-mvp.md). Decide consistently with these.

> This is a **product / business-model** decision. #087 flagged it as "genuinely a product decision,
> not an engineering one… needs a real product owner — do not let an agent ratify it." Prep does **not**
> ratify it; it brings the fork to researched options + a recommended default the owner then ratifies or
> overrides.

## The question

A CDN-like hosted Module-as-a-Service could be **free** for public/open components (A — a Skypack/esm.sh
for WE components), **paid** for private components + SLAs + custom domains + analytics (B), or **both**
(C — free public + paid private/pro, #087's lean-to-explore). The item framed these as one business-model
fork. This survey runs the owed economics pass and **reshapes it**: the dominant axis isn't free-vs-paid,
it's **build-vs-ride** — because the "free public" function is already a commodity someone else pays for.

## Prior-art survey — how comparable offerings are structured & priced

### The free public ESM CDN is already commoditized and free

| Service | Status (2025-26) | Funding | Bearing |
|---|---|---|---|
| **esm.sh** | Actively maintained (CLI v0.1.1, 2026-06-11; public 2026 roadmap) | GitHub Sponsors + Open Collective; CDN on **Cloudflare**; MIT, self-hostable | Serves npm/JSR/GitHub as ESM, free, no build — the modern default |
| **jsDelivr** | Actively maintained; 2025 edge upgrade | **100% sponsor-funded** — Cloudflare + Fastly **donate unlimited bandwidth**; founder personally covers origin | "No bandwidth limits, no premium features, completely free." **No paid tier exists** |
| **unpkg** | Maintenance inactive (Snyk: no release in 12mo) but operational | Cloudflare-sponsored | Coasting; works |
| **Skypack** | **Abandoned** — unmaintained since ~2023, breaks on modern JS (`#private` fields), recurring outages, **no maintainer communication** ([#365](https://github.com/skypackjs/skypack-cdn/issues/365)) | Was backed by Cloudflare/GCP/AWS (Snowpack team) | **The cautionary tale** (below) |

**Anyone who publishes to npm is already served, free, globally, by esm.sh + jsDelivr** — the byte-cost
donated by Cloudflare/Fastly. A new "free public tier" (option A alone) **rebuilds a commodity** two
well-funded incumbents give away, and inherits the maintenance liability for zero differentiation.

### "Free public + paid private" is the universal registry freemium pattern

| Registry | Public | Private |
|---|---|---|
| **npm** | Free, unlimited | Pro **$7/mo** / Teams **$7/user/mo** |
| **GitHub Packages** | Free | Free allotment then **metered**: $0.25/GB storage, $0.50/GB egress |
| **JSR** (jsr.io) | Free ("a public good… always free") | No paid tier (subsidized by Deno's broader business) |

The freemium split is the norm — **but the "free public" half only works because someone else pays the
bandwidth.** Running the registry/CDN *infra* yourself is the expensive part.

### Component-hosting businesses monetize workflow, not bytes

- **Bit (bit.cloud)** — public/private "scopes," free-to-start, paid per-seat (~$12-20/user/mo,
  semi-gated). **Pivoted away** from "component marketplace" to AI dev workspaces — pure
  component-distribution never became a standalone market.
- **Chromatic** (Storybook team) — hosted **visual testing + Storybook publishing**, not distribution.
  Free 5,000 snapshots/mo (unlimited for OSS), paid from **$149/mo**. The viable component-adjacent SaaS
  charges for a **value-add (QA/CI)**, not for serving bytes.
- **Backlight.dev** — design-system workbench, effectively wound down.

**Pattern:** the component businesses that survive charge for a *workflow value-add* (testing,
collaboration, migration), never for raw hosting/bandwidth.

### Operational burden — untenable for a solo operator

A global 24/7 public module CDN means multi-region edge, on-the-fly transpile, cache invalidation,
abuse/DoS handling, and **uncapped egress cost**. The healthy incumbents only survive on **donated**
Cloudflare/Fastly bandwidth — and jsDelivr's founder *still* personally subsidizes origin. A solo
founder can match neither, and carries the egress risk. This squares exactly with the project's standing
monetization stance ([[project_monetization_strategy]]: **defer live-serve**; solo-founder ranking
self-run tool > single service > enterprise-custom).

### Cautionary tale — Skypack

A well-funded, well-known team (Snowpack authors, backed by Cloudflare/GCP/AWS) built precisely the
"smart ESM CDN" product — and it silently rotted: unmaintained since ~2023, breaks on modern syntax,
recurring outages, abandonment issues with no maintainer reply. **A public module CDN is a forever
liability**: the moment maintenance lapses, every dependent breaks. A solo operator inherits that
liability with none of Skypack's backing.

## Recommendation (grounds #451)

**The reshaping — the real fork is build-vs-ride, not free-vs-paid.**

1. **Public tier → ride the commodity, don't build it.** Publish WE/FUI standard components to npm;
   esm.sh/jsDelivr already serve them as ESM, free, globally, today. Do **not** operate a public CDN.
2. **Paid surface → a thin value-add layer that needs no CDN infra** (the Chromatic playbook): a
   private/curated registry (metered storage à la GitHub Packages), provenance/SRI + SLA badge over
   packages that physically live on npm/jsDelivr, usage analytics (consume jsDelivr's public stats API),
   and migration/conformance tooling (pure async compute). This is the open-core "paid = value-add"
   shape, consistent with the cluster, and built **only when** the broader open-core tiering is settled.

So the original C (free public + paid private) survives as the *shape* — but realized as **free public
*via incumbents* + a thin paid value-add layer**, explicitly **not** "a public CDN we host."

## Classification — constellation layering (per #091), not the 7-question technical pass

This is a managed-offering/product decision, so the relevant classification is **where it lands in the
constellation** ([[project_managed_offering_constellation_layering]] — #091's ruling that managed
offerings decompose, with no single "home"):

- **Standard / resolver core** → Web Everything (`webadapters`) — already #087 phases (a)-(c) (cache
  contract, de-Vite'd self-hosted core, eager hot-set).
- **The components themselves, published to npm** → `@frontierui` (impl layer)
  ([[npm_scope_mirrors_layer]]) — the artifacts esm.sh/jsDelivr serve.
- **The served product (registry + value-add SaaS), if built** → plateau-app (open-core by usage), the
  live-serve tier #091 places product-side and [[project_monetization_strategy]] says **defer**.

The technical 7-question pass mostly resolves to "already settled upstream": layer (above); not a new
protocol/intent (it's distribution machinery on #088's content-addressed identity); DI/most-permissive
defaults are #087's engineering, not this product call. The genuine open content of #451 is the
business-model fork(s) below.

## Confidence

- **Fork 1 (build-vs-ride): high.** The economics are unambiguous — the public CDN is a donated-bandwidth
  commodity and a maintenance liability (Skypack); a solo operator should ride it, not rebuild it. This
  is also the cheapest reversible path (publishing to npm forfeits nothing).
- **Fork 2 (paid surface): medium — a genuine product call.** The *shape* (thin value-add, no CDN infra)
  is well-grounded, but whether/when to build any paid tier, and which value-add first, is the product
  owner's to ratify against the open-core cluster and the "defer live-serve" stance. Flagged accordingly.
