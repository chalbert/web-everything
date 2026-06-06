---
type: idea
status: open
dateOpened: "2026-06-06"
tags: [monetization, business-model, plateau, platform-manager, governance, dependency-graph, registries, injectors, contexts, enterprise]
relatedProject: webregistries
crossRef: { url: /backlog/089-monetization-product-ideas/, label: "Product ideas (#089, idea 5)" }
---

# Provider↔consumer relationship graph & governance — the core of Plateau as enterprise web platform manager

Not a package registry. **npm and git stay the source of bytes and versions** —
there is no need to re-host packages. What an enterprise lacks, and what Plateau
is meant to be, is a **control plane over the provider↔consumer relationships**
across its web platform: the graph of who provides what, who consumes it, and the
contracts at every seam. This reframes idea 5 in [#089](/backlog/089-monetization-product-ideas/)
(was "private registry + provenance") and is the capability that makes Plateau an
**enterprise web platform manager**, not just a serve-time host.

## What it tracks (beyond DI dependency)

Everything in the standard resolves through **introspectable** registries,
injectors, contexts, and events — that introspection *is* the graph. Plateau
aggregates it across repos/teams into one live model:

- **Protocol implementations** — which providers implement which protocols, at
  which conformance tier.
- **Consumption edges** — which components / teams / apps consume which providers,
  contexts (webcontexts), and scoped events (webevents). Not just "what are my
  dependencies" — the *bidirectional* relationship, including who depends on *me*.
- **Contracts at each seam** — the expected shape on both sides, so a change can
  be checked against every downstream consumer.

## What it does with the graph (the product)

- **Impact analysis** — "if I change/upgrade provider X, who breaks?" across the
  whole federated platform, before the change ships.
- **Cross-team contract drift** — detect when a provider change violates a
  consumer's expectation at the seam (the substrate behind #089 idea 1's
  cross-team verification).
- **Ownership & policy/governance** — who owns each provider, version/compat
  policy, allowed-provider lists, deprecation flows.
- **Platform map** — a live visualization of the org's web platform: providers,
  consumers, protocols, and where they're conformant.

## Why it's Plateau, and why it doesn't lock in

- It's the **enterprise web platform manager** layer — the management/governance
  plane that complements the serve-time providers (MaaS #081, Web Docs #091) and
  the continuous verification (#089 idea 1). Same introspection feeds all of them.
- **npm + git remain the source**; Plateau tracks *relationships*, not packages —
  so there's nothing to be locked into. The registries/injectors/contexts and
  their introspection are open and self-hostable; the **licensed product** is the
  cross-repo aggregation, the graph UI, and the governance workflows.

## Revenue

Enterprise license / per-seat platform-manager subscription. Strongly bundled
with continuous verification (#089 idea 1) — the graph is what makes "prove my
assembled app still holds together" possible, so they sell together.

## Open follow-ons

- Define the ingestion model: how Plateau harvests the introspectable graph from
  many repos (build-time export? a runtime agent? both?).
- The seam-contract representation — reuse the protocol conformance contracts so
  drift detection and verification share one definition.
- Confirm the home vs. graduating a Plateau-side project entry (same open question
  MaaS carries in #081).
