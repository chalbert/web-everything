---
type: idea
workItem: story
size: 5
parent: "089"
status: open
dateOpened: "2026-06-06"
tags: [monetization, business-model, webdocs, plateau, hosting, conformance, design-system, documentation]
relatedProject: webdocs
crossRef: { url: /backlog/089-monetization-product-ideas/, label: "Product ideas (#089, idea 4)" }
---

# Web Docs as a Service — a hosted Plateau offering

Promote **"Web Docs as a Service"** (idea 4 in [#089](/backlog/089-monetization-product-ideas/))
into a first-class **Plateau offering**: hosted, private, conformance-aware
documentation for a customer's *own* design system / component library, generated
the same way this repo generates itself — "the website IS the spec." It sits in
the **managed-Plateau** umbrella next to Module-as-a-Service ([#081](/backlog/081-module-as-a-service-provider/)),
sharing Plateau's serve-time host, registry, and delivery infra.

## What it is

`webdocs` is the meta-standard that orchestrates **Web Manifests** + **Web Cases**
to generate a docs site. As a Plateau offering, a customer points it at their own
manifest + cases and gets a hosted living-spec site — not static stories, but
docs **derived from the conformance source of truth**, with an interop/conformance
dashboard alongside.

## Why it belongs on Plateau (not a standalone app)

- Plateau is already the serve-time host (MaaS runs there); Web Docs is another
  managed provider on the same platform — one billing/hosting/auth surface.
- Single source of truth across products: the **same `webcases`** power (a) the
  generated docs, (b) the unit/E2E tests, and (c) the continuous-verification
  conformance signal (#089 idea 1). One artifact, three outputs.

## Differentiator vs. Storybook / Chromatic

The docs **prove conformance**. Because they're generated from the manifest +
cases that *are* the protocol-conformance fixtures, the site shows live which
protocols each component satisfies (and at which tier), not just rendered
examples. A design-system docs site that doubles as an interop dashboard.

## Revenue & open premise

- **Revenue:** per-org hosted tier (Chromatic / Storybook-Cloud analog), licensed
  managed service.
- **Open premise intact:** the `webdocs` generator and the standards it consumes
  stay open and self-hostable — open source = free, the **paid product is the
  licensed hosting**, not the generator. "Cancel and self-host" always holds; they
  keep the generator and the output.

## Open follow-ons

- Pin down the ingestion contract: what a customer supplies (their `webmanifest`
  + `webcases`) and how Plateau resolves/serves it.
- Decide the conformance-dashboard surface — reuse the `/protocols/` + verification
  machinery (#089 idea 1) so docs + badge + tests are one pipeline.
- Confirm the home: a Plateau offering vs. a graduated Plateau-side project entry
  (same open question MaaS carries in #081).
