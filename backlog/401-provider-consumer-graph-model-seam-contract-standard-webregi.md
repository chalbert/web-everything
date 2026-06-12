---
type: issue
workItem: story
size: 5
parent: "092"
status: resolved
blockedBy: ["400"]
dateOpened: "2026-06-12"
dateStarted: "2026-06-12"
dateResolved: "2026-06-12"
graduatedTo: webregistries
tags: []
---

# Provider-consumer graph-model + seam-contract standard (webregistries)

The open WE half of the #092 ruling: the introspectable graph-model schema plus the seam-contract at each provider-consumer edge. Reuses the protocol conformance contract (protocols.json) for the provider side; the consumer-driven projection (consumer declares the capability subset it depends on) is NET-NEW schema, not free reuse — scope it as new work. Self-hostable, @webeverything-scoped (the 'nothing to lock into' half). Blocked on #400 (introspection must emit consumption edges first). Gates the plateau-app aggregation/impact-analysis/governance product.

## Progress (2026-06-12) — WE standard authored

Authored the WE-layer standard as a **Protocol** (`provider-consumer-graph`, owned by `webregistries`). #400 (resolved) supplied the consumer-side introspection (`Injector.consumptionEdges()`).

- **`src/_data/protocols.json`** — new `provider-consumer-graph` entry (`status: concept`, `ownedByProject: webregistries`).
- **`src/_includes/project-webregistries.njk`** — normative `<section id="protocol-provider-consumer-graph">`: (1) the **graph-model schema** (`GraphNode`/`GraphEdge`/`ProviderConsumerGraph` — directed multigraph, `provides`/`consumes` edges, `confidence` confirmed/potential, build-time auto-derived); (2) the **seam-contract** (`SeamContract` — reused provider tier + the net-new `consumerRequires` consumer-driven projection; compatible ⇔ subset containment). Boundary spelled out: schema + contract only; aggregator/UI/governance = plateau-app.
- **`src/_data/semantics.json`** — two new terms: *Consumption Edge*, *Consumer-Driven Projection*.

**Boundary respected (#092 Fork 3):** only the open, self-hostable graph-model + seam-contract live here. The cross-repo aggregation, impact-analysis UI, and governance workflows remain the licensed plateau-app product (graduated chain `graph-model → impact-analysis → governance-UI → platform-map`). This item delivers the `graph-model` slice's standard.
