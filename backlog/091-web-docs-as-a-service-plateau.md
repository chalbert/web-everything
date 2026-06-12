---
type: decision
workItem: story
size: 5
parent: "089"
status: resolved
dateOpened: "2026-06-06"
dateStarted: "2026-06-12"
dateResolved: "2026-06-12"
graduatedTo: webdocs
preparedDate: "2026-06-11"
relatedReport: reports/2026-06-11-web-docs-as-a-service.md
tags: [monetization, business-model, webdocs, plateau, hosting, conformance, design-system, documentation]
relatedProject: webdocs
crossRef: { url: /backlog/089-monetization-product-ideas/, label: "Product ideas (#089, idea 4)" }
---

# Web Docs as a Service — a hosted Plateau offering

> **Reclassified `idea` → `decision` (2026-06-10, batch claim-time pre-flight).** A monetization
> product concept under epic #089, not a mechanical build: the *Open follow-ons* (ingestion contract,
> conformance-dashboard surface, Plateau-offering-vs-graduated-project home) are strategy decisions that
> must settle before any code. Surface-and-discuss (Tier B), don't auto-build.

## Ruling (2026-06-12) — RESOLVED

Decided in session `091-web-docs-as-a-service-plateau`. Web Docs **decomposes across the repo
constellation** like every other concept — it was never a monolith needing one "home", which dissolves
Fork 3 rather than deferring it:

| Layer | Web Docs piece | Repo |
|---|---|---|
| **Standard** | the `webdocs` meta-standard (`webmanifest`+`webcases` → docs) | **WE** — exists ([projects.json:226](../src/_data/projects.json#L226)) |
| **Open primitives** | enough free, composable parts to assemble a *self-hosted* Web Docs UI — the "cancel and self-host always holds" floor (load-bearing, not a nicety) | **Frontier UI** |
| **Adapters / impl** | ingest incumbents (Storybook/Mintlify → the `webcases` pivot, lossy normalization-hub) + generator impl | **Frontier UI** |
| **Complete product** | the tested, flexible, polished served site + per-customer conformance/coverage report | **`plateau-app`** |

- **Fork 1 (ingestion): RATIFIED — docs-as-code.** Customer's `webmanifest`+`webcases` are the source;
  Plateau never owns content. Incumbent-format normalization is the FUI adapter layer.
- **Fork 2 (dashboard): RATIFIED (sharpened) — reuse the pattern.** The `/protocols/`+`capabilityMatrix`
  *pattern* is reused; the served, per-customer dashboard is a **`plateau-app` product surface** consuming
  WE-standard + FUI output. WE's own `/protocols/` page stays WE self-documentation.
- **Fork 3 (home): DISSOLVED.** No new project taxonomy / "graduate to a project entry" call — the
  standard's entry already lives in WE; the product lives in `plateau-app` by the constellation invariant.
  MaaS (#081) obeys the same layering, so the two stay in lockstep *by construction*, not by a shared open
  question. #081's parked "home decision" answers the same way and need not be duplicated here.
- **Monetization: open-core by usage.** FUI primitives are free (self-host floor); the complete
  `plateau-app` product is **free and paid depending on usage** (free tier → paid beyond a usage
  threshold), not a free-vs-licensed binary. Open premise intact: cancel and self-host always holds.

**Unblocks:** #336 (migrate dev-guide onto `webdocs`, now targets `plateau-app`). `graduatedTo: webdocs`.

## Digest

Grounded in the [Web Docs as a Service prior-art survey](/research/web-docs-as-a-service/)
([report](../reports/2026-06-11-web-docs-as-a-service.md)) — docs-as-a-service incumbents
(Mintlify, Docusaurus, ReadMe, GitBook, Storybook+Chromatic) and conformance/coverage
dashboards (axe-core-in-Chromatic, Gestalt a11y scorecard, VPAT/ACR). The item's three open
follow-ons reshape into three bold-defaulted forks. **Fork 1 (ingestion):** docs-as-code — the
customer's own `webmanifest`+`webcases` *are* the source of truth (the Mintlify model), Plateau
never owns content — *not* a platform-first dashboard. **Fork 2 (dashboard):** reuse the existing
`/protocols/` + `capabilityMatrix` + #089-idea-1 verification machinery as one pipeline — *not* a
parallel bolt-on dashboard. **Fork 3 (home):** a managed *offering* under the Plateau umbrella,
resolving its home in lockstep with MaaS (#081); graduate to a project entry only when a second
consumer demands it.

## Axis-framing

The managed-docs market splits ingestion two ways, and that split decides fork 1: **docs-as-code**
keeps the source of truth in the customer's repo (Mintlify generates pages from the customer's
OpenAPI spec and re-publishes on commit; Docusaurus is the open self-hosted end) vs **platform-first**
(ReadMe/GitBook can become the source of record — the lock-in WE refuses). WE is structurally
docs-as-code: `webdocs` is registered as "the meta-standard that orchestrates Web Manifests and Web
Cases to generate documentation sites" ([projects.json:226](../src/_data/projects.json#L226)), so the
OpenAPI-spec equivalent is the customer's `webmanifest` ([projects.json:217](../src/_data/projects.json#L217))
+ `webcases` ([projects.json:208](../src/_data/projects.json#L208)) pair — artifacts they already
maintain for their tests. This repo's own `cases.js` loader ([src/_data/cases.js](../src/_data/cases.js))
performs exactly this ingestion at build time; the serve-time offering is that loader, hosted. The
conformance-dashboard edge over Storybook/Chromatic is already on disk: the `/protocols/` index
([src/protocols.njk](../src/protocols.njk)) renders what implementations must agree on (filterable by
project + status), the `capabilityMatrix` ([src/_data/capabilityMatrix.json](../src/_data/capabilityMatrix.json),
rendered by [src/capabilities.njk](../src/capabilities.njk)) maps each impl to a 3-state tier, and
#089 idea 1 re-runs the suite over time — so fork 2 is reuse-vs-rebuild, not build-from-scratch.
The home follow-on is verbatim the open "home decision" MaaS parks
([backlog/081:75](./081-module-as-a-service-provider.md#L75): "stays under `webadapters` or graduates
to its own Plateau-side project entry") — both are managed providers on one Plateau host, so fork 3
should resolve in lockstep with it.

### Recommended path at a glance

Ratify all three rows, or override just the one you'd change. The **confidence** column says where
judgment is actually needed vs. where to nod.

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **1 · ingestion contract** | docs-as-code: customer's `webmanifest`+`webcases` are the source, Plateau never owns content | platform-first dashboard authoring *(rejected)* | **High** — Mintlify model + open-premise + existing `cases.js` |
| **2 · dashboard surface** | reuse `/protocols/` + `capabilityMatrix` + #089-idea-1 verification, one pipeline | bespoke bolt-on a11y/coverage dashboard *(rejected)* | **High** — the machinery already renders; one source of truth |
| **3 · home** | managed *offering* under Plateau; resolve home in lockstep with MaaS (#081) | graduate to own project entry now | **Med** — defer-until-second-consumer; tied to #081's ruling |

## Fork 1 — the ingestion contract: what does a customer supply?

**Crux.** The market's whole identity is its ingestion model (report finding 1). Docs-as-code
(Mintlify/Docusaurus) keeps the source of truth in the customer's repo and generates from an artifact
they already maintain; platform-first (ReadMe/GitBook) lets the vendor become the source of record.
WE's source already exists and is not prose: `webmanifest` ([projects.json:217](../src/_data/projects.json#L217))
+ `webcases` ([projects.json:208](../src/_data/projects.json#L208)) are the same artifacts that drive
the customer's tests and conformance signal, and `cases.js` ([src/_data/cases.js](../src/_data/cases.js))
already ingests them at build time.

- **(A — recommended) Docs-as-code: the customer supplies their `webmanifest` + `webcases`; Plateau
  resolves and serves, never owns the content.** Plateau points at the customer's manifest+cases
  (Git repo, uploaded bundle, or registry URL), runs the open `webdocs` generator serve-time, and
  hosts the output. Mirrors Mintlify's spec-driven generation; preserves the open premise (the
  generator + standards stay self-hostable, "cancel and self-host" always holds — report finding 5);
  reuses `cases.js` rather than a parallel ingestion path. Cost: must pin the resolve/serve contract
  (repo vs bundle vs URL) and the single-source guarantee with the open generator, so served docs
  can't drift from self-hosted output.
- **(B) Platform-first authoring** — a hosted editor/dashboard where docs are authored in Plateau.
  Lower-friction onboarding for non-developers (GitBook's pitch), but makes Plateau the source of
  record, breaking "cancel and self-host" and contradicting the open premise. *Rejected.*
- **Sub-decision (hold open):** resolve-input shape — Git repo (Mintlify) vs uploaded bundle vs
  manifest/registry URL (#081's ESM-CDN seam). Default to *all three behind one resolver contract*,
  most-flexible-default; the restriction is the customer's opt-in.

*Rejected branches:* platform-first authoring (B, breaks open premise); a bespoke non-`webcases`
ingestion format (would fork the single-source-of-truth and contradict #089 idea 4's "one artifact,
three outputs").

## Fork 2 — the conformance-dashboard surface: reuse or rebuild?

**Crux.** #091's differentiator is that the docs *prove conformance* — live which protocols each
component satisfies and at which tier, because the docs are generated from the fixtures that *are*
the conformance suite. The market bolts a conformance view onto docs after the fact (axe-core in
Chromatic; Gestalt's "A11y readiness indicator"; VPAT/ACR — report finding 3). WE has the surface
natively: `/protocols/` ([src/protocols.njk](../src/protocols.njk)), `capabilityMatrix`
([src/capabilities.njk](../src/capabilities.njk), data [capabilityMatrix.json](../src/_data/capabilityMatrix.json)),
and #089 idea 1's continuous verification.

- **(A — recommended) Reuse the existing surface as one pipeline.** The hosted docs render the
  customer's conformance from the *same* `/protocols/` + `capabilityMatrix` + verification machinery
  the WE site already uses — docs, badge, and tests are one pipeline (#089 idea 4's "one artifact,
  three outputs"). No parallel dashboard to maintain; the conformance facts have a single source.
  Cost: the machinery must be parameterized per-customer (their protocols/impls, not WE's), which is
  a generalization of the existing static build-matrix, not a new dashboard.
- **(B) Bespoke bolt-on dashboard** — a standalone conformance/coverage view built for the offering.
  Matches what the incumbents ship, but duplicates the protocols/matrix machinery, risks drift
  between the served dashboard and the self-hosted `/protocols/` page, and adds a surface to
  maintain. *Rejected.*

*Rejected branches:* bespoke bolt-on (B, duplicates machinery); deferring conformance entirely to a
plain docs site (would erase the stated differentiator vs Storybook/Chromatic — the docs would no
longer prove anything).

## Fork 3 — the home: Plateau offering vs graduated project entry

**Crux.** #091's third follow-on ("a Plateau offering vs a graduated Plateau-side project entry") is
verbatim the open home decision MaaS parks ([backlog/081:75](./081-module-as-a-service-provider.md#L75)).
Both are managed providers on one Plateau serve-time host sharing one billing/auth/hosting surface
(#089 puts ideas 2/4/5 under "Plateau as the enterprise web platform"). `webdocs` exists today as a
`concept` project entry ([projects.json:226](../src/_data/projects.json#L226)); the question is
whether the *service* is a sibling offering or earns its own entry now.

- **(A — recommended) A managed *offering* under the Plateau umbrella; resolve the home in lockstep
  with MaaS (#081).** The service is a provider on Plateau next to MaaS, not a new top-level project;
  `webdocs` stays the open generator/standard it already is. Defer the graduate-to-project call until
  a second consumer demands it (avoids a one-off provider taxonomy, and keeps #081 + #091 from
  diverging on the same question). Cost: a deferred decision, re-opened when a second managed
  offering or external consumer appears.
- **(B) Graduate to its own Plateau-side project entry now.** Cleaner ownership/visibility if the
  service grows distinct infra fast, but pre-commits a taxonomy before a second consumer justifies
  it, and would let #081 and #091 settle the identical question two different ways. *Rejected (for
  now).*

*Rejected branches:* graduate-now (B, premature taxonomy); standalone app off Plateau (contradicts
the entire "why it belongs on Plateau" premise — one billing/hosting/auth surface, shared serve-time
host).

---

## Preserved context (original item)

Promote **"Web Docs as a Service"** (idea 4 in [#089](/backlog/089-monetization-product-ideas/))
into a first-class **Plateau offering**: hosted, private, conformance-aware
documentation for a customer's *own* design system / component library, generated
the same way this repo generates itself — "the website IS the spec." It sits in
the **managed-Plateau** umbrella next to Module-as-a-Service ([#081](/backlog/081-module-as-a-service-provider/)),
sharing Plateau's serve-time host, registry, and delivery infra.

### What it is

`webdocs` is the meta-standard that orchestrates **Web Manifests** + **Web Cases**
to generate a docs site. As a Plateau offering, a customer points it at their own
manifest + cases and gets a hosted living-spec site — not static stories, but
docs **derived from the conformance source of truth**, with an interop/conformance
dashboard alongside.

### Why it belongs on Plateau (not a standalone app)

- Plateau is already the serve-time host (MaaS runs there); Web Docs is another
  managed provider on the same platform — one billing/hosting/auth surface.
- Single source of truth across products: the **same `webcases`** power (a) the
  generated docs, (b) the unit/E2E tests, and (c) the continuous-verification
  conformance signal (#089 idea 1). One artifact, three outputs.

### Differentiator vs. Storybook / Chromatic

The docs **prove conformance**. Because they're generated from the manifest +
cases that *are* the protocol-conformance fixtures, the site shows live which
protocols each component satisfies (and at which tier), not just rendered
examples. A design-system docs site that doubles as an interop dashboard.

### Revenue & open premise

- **Revenue:** per-org hosted tier (Chromatic / Storybook-Cloud analog), licensed
  managed service.
- **Open premise intact:** the `webdocs` generator and the standards it consumes
  stay open and self-hostable — open source = free, the **paid product is the
  licensed hosting**, not the generator. "Cancel and self-host" always holds; they
  keep the generator and the output.

### Open follow-ons (now reshaped into the three forks above)

- Pin down the ingestion contract: what a customer supplies (their `webmanifest`
  + `webcases`) and how Plateau resolves/serves it. → **Fork 1**
- Decide the conformance-dashboard surface — reuse the `/protocols/` + verification
  machinery (#089 idea 1) so docs + badge + tests are one pipeline. → **Fork 2**
- Confirm the home: a Plateau offering vs. a graduated Plateau-side project entry
  (same open question MaaS carries in #081). → **Fork 3**
