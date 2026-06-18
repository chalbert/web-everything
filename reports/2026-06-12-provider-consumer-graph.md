# Prior-art survey — provider↔consumer relationship graph & governance (backlog #092)

**Date:** 2026-06-12 · **For:** decision item [#092](../backlog/092-provider-consumer-graph-platform-manager.md)
· **Published as:** `/research/provider-consumer-graph/`

/ prep pass (`/prepare 092`) — autonomous research half of the decision. Surveys the internal-developer-
platform / software-catalog / contract-testing prior art so #092's three forks (ingestion model ·
seam-contract representation · home) are grounded before the human call. No ruling made; item stays
`open + preparedDate`.

## The gap

#092 reframes [#089](../backlog/089-monetization-product-ideas.md) idea 5 ("private registry +
provenance") into the **control plane over provider↔consumer relationships** that makes Plateau an
*enterprise web platform manager*. Not a package registry — **npm + git stay the source of bytes**;
Plateau tracks *relationships*: who provides what, who consumes it, the contract at each seam, and impact
analysis ("if I change provider X, who breaks?"). The item names three unsettled forks; this survey
grounds them.

## What the survey found

### 1 · Ingestion — the field has converged on "both, build-first"

The two ingestion models are mature, named industry patterns with a documented complementary consensus:

- **Build-time / declared** — [Backstage software
  catalog](https://backstage.io/docs/features/software-catalog/well-known-relations/): components declare
  `spec.providesApis` / `spec.consumesApis` in `we:catalog-info.yaml`; the catalog derives `apiProvidedBy` /
  `apiConsumedBy` **relations**. [CycloneDX SBOM](https://cyclonedx.org/guides/sbom/generation/) is the
  same shape for dependencies. *Strength:* complete, auditable, pre-ship. *Weakness:* "all dependency
  information is lost at runtime"; hand-authored manifests drift; phantom (lock-file-only) edges.
- **Runtime agent** — [OpenTelemetry service-graph
  connector](https://oneuptime.com/blog/post/2026-02-06-otel-service-dependency-graphs-traces/view):
  client/server span pairs aggregate into a live topology. *Strength:* "the only accurate dependency map
  is one generated from actual production traffic." *Weakness:* "a map from last month is already wrong";
  misses uninstrumented edges.
- **Both** — the explicit field recommendation: *"use static analysis for initial discovery, but validate
  with runtime data, marking dependencies as 'potential' until confirmed by traces or mesh metrics."*

**The WE-specific reframe (the decisive finding):** Backstage's build-time model is bottlenecked on
*hand-authored* `we:catalog-info.yaml`. WE doesn't have that bottleneck — **everything resolves through
introspectable registries, injectors, contexts (webcontexts), and events (webevents); that introspection
*is* the graph.** WE can **auto-derive** the provider/consumer manifest at build time from its own
introspection, eliminating the manual-authoring weakness that makes Backstage's build-time tier stale. So
the build-time tier is both *complete* (Backstage's strength) and *not hand-maintained* (fixing its
weakness) — which makes "build-first, runtime as drift-enrichment" the natural staging, not a compromise.

### 2 · Seam-contract — consumer-driven contracts, reusing WE's conformance contracts

The mature pattern for "what is the contract at an edge, and how is drift detected" is **consumer-driven
contract testing** ([Pact](https://docs.pact.io/) / [Pactflow](https://pactflow.io/what-is-consumer-driven-contract-testing/)):

- The **consumer declares the subset it actually depends on**; "any provider behavior not used by current
  consumers is free to change without breaking" — a *lossy consumer projection* of the provider's full
  surface.
- The **Pact Broker is the source of truth** for whether a consumer version + provider version are "safe
  to deploy together" — exactly #092's impact-analysis question.
- **Drift detection** "flips from reactive to proactive": a provider change checked against every
  recorded consumer expectation before it ships.

WE already has the provider-side half: **protocol conformance contracts + tiers**
([we:protocols.json](../src/_data/protocols.json), the capabilityMatrix). The reframe: the seam-contract is
the **protocol conformance contract recorded bidirectionally** — provider declares the tier it implements;
consumer declares the subset (dimensions/capabilities) it depends on (the consumer-driven projection). One
definition, shared with verification (#089 idea 1) and drift detection — no second contract format.

### 3 · Home — the WE/Plateau split writes itself

Per the constellation doctrine (WE = open standard; Plateau = licensed product; impl = Frontier UI) and
the npm-scope rule (`@webeverything` = standard artifacts only): the **graph model + the seam-contract
definition are WE standard concerns** (open, self-hostable — nothing to lock into, matching #092's own
"npm + git remain the source" framing); the **cross-repo aggregation, the graph UI, and the governance
workflows are the Plateau licensed product.** This is the same provider-side/aggregation-side split MaaS
([#081](../backlog/081-module-as-a-service-provider.md)) carries.

## Forks this grounds (see the item for options + defaults)

1. **Ingestion model** — build-time (auto-derived from WE introspection) · runtime agent · **both, staged
   build-first**.
2. **Seam-contract representation** — reuse the protocol conformance contract bidirectionally (consumer-
   driven projection) vs a separate Pact-style contract format.
3. **Home** — WE standard owns graph-model + contracts; Plateau product owns aggregation + UI + governance.

## Sources

- [Backstage — well-known relations](https://backstage.io/docs/features/software-catalog/well-known-relations/) · [descriptor format](https://backstage.io/docs/features/software-catalog/descriptor-format/) · [external integrations / entity providers](https://backstage.io/docs/features/software-catalog/external-integrations/)
- [Pact docs](https://docs.pact.io/) · [Pactflow — what is CDC](https://pactflow.io/what-is-consumer-driven-contract-testing/)
- [CycloneDX SBOM generation](https://cyclonedx.org/guides/sbom/generation/) · [OWASP dependency-graph SBOM](https://cheatsheetseries.owasp.org/cheatsheets/Dependency_Graph_SBOM_Cheat_Sheet.html)
- [OpenTelemetry service dependency graphs from traces](https://oneuptime.com/blog/post/2026-02-06-otel-service-dependency-graphs-traces/view)
