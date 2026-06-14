---
type: decision
workItem: story
size: 2
status: resolved
dateOpened: "2026-06-12"
dateStarted: "2026-06-13"
dateResolved: "2026-06-13"
graduatedTo: none
preparedDate: "2026-06-13"
tags: [module-as-a-service, distribution, cdn, pricing, monetization, open-core, product, design-decision]
relatedProject: webadapters
relatedReport: reports/2026-06-13-maas-hosted-tier-economics.md
crossRef: { url: /backlog/089-monetization-product-ideas/, label: "Monetization product ideas (#089)" }
---

# MaaS hosted-tier shape & pricing: free public / paid private / both

## Ruling (2026-06-13)

Both forks ratified to the recommended defaults by the product owner:

- **Fork 1 — public-tier delivery: RIDE.** Do not operate a public CDN/registry. Publish WE/FUI
  components to npm; let esm.sh/jsDelivr serve them as ESM, globally, free. Rationale stands as
  written — commodity function, donated-bandwidth economics, Skypack liability, reversible/additive.
- **Fork 2 — paid surface: C (freemium, thin paid value-add layer).** Free public *via incumbents*
  + a paid private/pro layer that needs no CDN infra (private/curated registry, provenance/SRI+SLA,
  usage analytics off jsDelivr's public stats, migration/conformance tooling). Open-core consistent
  (paid = value-add, not bytes). **Direction only** — *which* value-add ships first and *when* is
  deferred to the product owner once the open-core tiering (#089/#091) settles; live-serve stays
  deferred per the open-core monetization strategy (defer live-serve). (B paid-public rejected — kills the free on-ramp.)

This unblocks **#087 phase (d)** (hosted CDN-like service + registry) as a *deferred* build, now
scoped to "ride + thin value-add," not "operate a CDN." No new entity graduates from this decision;
the artifacts it points at already exist (npm-published `@frontierui`, the value-add SaaS lands
product-side in plateau-app if/when built).

**Grounding.** Carved off **#087** (MaaS distribution), which flagged this as *"genuinely a product
decision, not an engineering one… needs a real product owner — do not let an agent ratify it."* This is
prepared, not decided: the owed economics pass is published at
[/research/maas-hosted-tier-economics](/research/maas-hosted-tier-economics/) (report:
[2026-06-13-maas-hosted-tier-economics.md](reports/2026-06-13-maas-hosted-tier-economics.md)), and **it
reshaped the framing** — the A/B/C "which tiers do we host" question is the wrong axis; the dominant fork
is **build-vs-ride**, because the "free public" function is already a commodity someone else pays for.
**Two forks below, each with a recommended default the product owner ratifies or overrides** (confidence
flags mark where the call is genuinely the owner's).

**Gating:** this gates **only #087's phase (d)** (the hosted CDN-like service + registry) — not phases
(a) cache headers, (b) self-hosted core, (c) eager warming. So #087 is **not** `blockedBy` this item.

## Axis framing

- **Axis 1 — public-tier delivery (the reshaping).** Does the "free public" tier get *built* (operate a
  CDN/registry) or *ridden* (publish components to npm; let esm.sh/jsDelivr serve them)? The survey is
  decisive: serving any npm package as ESM globally for free is a **commodity** — jsDelivr has *no paid
  tier* and runs on **donated** Cloudflare/Fastly bandwidth; esm.sh likewise. #087's own engineering
  note already says "lean on standard CDN/edge infra, don't build a bespoke cache"
  ([087:33](/backlog/087-module-service-distribution-caching/)). **Skypack** is the cautionary tale: a
  backed team's smart-ESM-CDN that went unmaintained and broke its dependents. This is the real fork.
- **Axis 2 — the paid surface.** Given ride-the-commodity, the original free/paid/both question narrows
  to: *is there a paid layer, and what shape, given it must add value without running CDN infra?* The
  surviving component businesses (Chromatic) charge for **workflow value-add**, not bytes; Bit pivoted
  away from raw distribution entirely.
- **Cluster constraint.** Decide consistently with the open-core cluster — open=free, paid=value-add:
  **#089** product ideas, **#091** constellation layering (served product → plateau-app), **#097**
  emergent-MVP — and the standing **defer-live-serve** stance.

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **1 — public-tier delivery** | **Ride existing CDNs — publish components to npm; esm.sh/jsDelivr serve them free. Do not operate a public CDN.** | Operate our own free public CDN/registry (option A) | High — commodity + Skypack liability + donated-bandwidth economics |
| **2 — paid surface** | **C realized as freemium: free public *via incumbents* + a thin paid private/value-add layer needing no CDN infra (private registry, provenance/SLA, analytics, migration tooling).** Build only when open-core tiering settles; defer live-serve. | Paid-public-only (B, no free on-ramp) · or no paid tier at all | Medium — genuine product call; owner ratifies which value-add & when |

## Fork 1 — public-tier delivery: ride existing CDNs vs operate our own

**Crux.** The "free public ESM CDN for any npm package" function is already provided, free, by esm.sh +
jsDelivr (bandwidth donated by Cloudflare/Fastly). So a "free public tier" is either *ridden* (publish to
npm) or *rebuilt* (operate infra). Operating it is a forever maintenance + uncapped-egress liability a
solo operator can't carry.

- **Ride existing CDNs (default).** Publish WE/FUI standard components to npm; esm.sh/jsDelivr serve them
  as ESM, globally, free, today. Zero infra, zero egress risk, zero new liability; forfeits nothing
  (publishing to npm is reversible/additive). Matches #087's "don't reinvent the wheel" note and the
  npm-scope-mirrors-layer convention (components publish `@frontierui`).
- **Operate our own free public CDN/registry (option A).** Build a Skypack/esm.sh for WE components.
  Rebuilds a commodity for **zero differentiation**, and inherits the operational burden (multi-region
  edge, transpile, abuse, **uncapped egress**) that incumbents only survive via *donated* bandwidth.

**Default: ride.** The economics are unambiguous and the path is the cheapest, most reversible. The
public-distribution problem is already solved by infrastructure WE can use for free.

*Rejected — operate our own:* the **Skypack** cautionary tale (a Cloudflare/GCP/AWS-backed team's
ESM-CDN that rotted and abandoned users) is precisely the liability a solo operator must avoid; building
it duplicates a free commodity.

## Fork 2 — the paid surface: thin value-add layer vs paid-public vs none

**Crux.** Ride-the-commodity removes "free public" from the build. What, if anything, is the *paid*
offering — and can it add value **without** running CDN infrastructure?

- **C as freemium, realized as a thin paid value-add layer (default).** Free public *via incumbents* +
  a paid private/pro layer that needs no CDN infra: a **private/curated registry** (metered storage à la
  GitHub Packages — not bandwidth-heavy), **provenance/SRI + SLA** over packages that physically live on
  npm/jsDelivr, **usage analytics** (consume jsDelivr's public stats API), and **migration/conformance
  tooling** (pure async compute). The Chromatic playbook (charge for workflow, not bytes); open-core
  consistent; **built only when** the broader open-core tiering (#089/#091) settles — live-serve deferred.
- **Paid-public-only (B).** Charge for the public registry too. No free on-ramp → no adoption flywheel;
  contradicts the standard's distribution goal (the public tier *is* the standard's reach).
- **No paid tier at all (A-only, pure adoption).** Public distribution via incumbents, never monetized.
  Legitimate if MaaS stays a pure adoption play, but forfeits the open-core revenue the cluster targets.

**Default: C (thin value-add layer).** It captures the universal freemium shape while honouring "don't
run CDN infra," and slots into the open-core cluster as paid = value-add. **Owner ratifies which
value-add ships first and when** — flagged medium-confidence as a true product call.

*Rejected — B (paid-public):* removes the adoption on-ramp the public tier exists to provide.

## Classification — constellation layering (per #091)

This is a managed-offering/product decision, so the relevant classification is **where it decomposes in
the constellation** (managed offerings decompose across the constellation, no single home — #091's
ruling), not the technical 7-question pass (the engineering is settled upstream in #087 phases a-c):

- **Standard / resolver core** → Web Everything (`webadapters`), already #087 (a)-(c).
- **Components published to npm** → `@frontierui` (impl) — the artifacts
  esm.sh/jsDelivr serve.
- **Served product (registry + value-add SaaS), if built** → plateau-app (open-core by usage); the
  live-serve tier #091 places product-side and the open-core monetization strategy says **defer**.

The technical pass resolves to "already settled upstream": not a new protocol/intent (distribution
machinery on #088's content-addressed identity); DI/most-permissive defaults are #087's engineering. The
genuine open content here is the two business-model forks above.

## Concrete refs

- Parent: [087-module-service-distribution-caching.md](/backlog/087-module-service-distribution-caching/)
  — "Hosted-tier shape & pricing" decision ([:34](/backlog/087-module-service-distribution-caching/)),
  phasing ([:42](/backlog/087-module-service-distribution-caching/), phase d), "don't reinvent the
  wheel" note ([:33](/backlog/087-module-service-distribution-caching/)).
- Cluster: [#089](/backlog/089-monetization-product-ideas/) (product ideas),
  [#091](/backlog/091-managed-offering-constellation-layering/) (constellation layering),
  [#097](/backlog/097-roadmap-to-mvp/) (emergent MVP).
- Prior-art survey: [report](reports/2026-06-13-maas-hosted-tier-economics.md) ·
  [/research/ topic](/research/maas-hosted-tier-economics/).

> **Product gate:** the recommendation brings this to Definition of Ready; it does **not** ratify it.
> The free/paid/build commitment is a go-to-market call for the product owner — make it (or override the
> default) via `/next decision`, consistently with the open-core cluster.
