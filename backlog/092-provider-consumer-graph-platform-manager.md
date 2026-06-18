---
type: decision
workItem: story
size: 8
parent: "089"
status: resolved
codifiedIn: docs/agent/platform-decisions.md#monetization
dateOpened: "2026-06-06"
dateStarted: "2026-06-12"
dateResolved: "2026-06-12"
graduatedTo: "project:webregistries"
preparedDate: "2026-06-12"
relatedReport: reports/2026-06-12-provider-consumer-graph.md
tags: [monetization, business-model, plateau, platform-manager, governance, dependency-graph, registries, injectors, contexts, enterprise]
relatedProject: webregistries
crossRef: { url: /research/provider-consumer-graph/, label: "Provider↔consumer graph survey" }
---

# Provider↔consumer relationship graph & governance — the core of Plateau as enterprise web platform manager

## Ruling (2026-06-12) — RESOLVED

Decided in session `092-provider-consumer-graph-platform-manager`. All three forks ratified at their
prepared defaults:

- **Fork 1 (ingestion): RATIFIED — C, both, build-first.** Build-time manifest auto-derived from WE
  introspection is the source of truth; the **runtime agent is deferred** (a later drift-enrichment
  follow-on, edges marked *potential* until trace-confirmed), not first-cut scope.
- **Fork 2 (seam-contract): RATIFIED — reuse the protocol conformance contract, bidirectional.** No
  parallel Pact-style format. **Caveat recorded:** only the *provider* side exists today
  ([we:protocols.json](src/_data/protocols.json)); the **consumer-driven projection** (consumer declares the
  capability subset it depends on) is **net-new schema**, not free reuse — the downstream build must scope
  it as new work.
- **Fork 3 (home): RATIFIED — split per the constellation** (precedent, not a fresh call — same answer
  as [#091](/backlog/091-web-docs-as-a-service-plateau/) and the one #081 will take). Graph-model + seam-contract
  → **WE** open standard (`webregistries`, self-hostable — the "nothing to lock into" half); cross-repo
  aggregation + graph UI + governance workflows → **plateau-app** licensed product.

**Prerequisite recorded (a fact to verify, not a fork):** "build-time auto-derived" assumes WE
introspection already emits **consumption edges** (`consumesApis`-equivalent). If it does, auto-derive is
nearly free as claimed; if not, the graph-model build's **first task is extending introspection to emit
edges**. This becomes the first `blockedBy` link in the graduation chain rather than an assumed
precondition — see spin-off below.

**Graduation:** re-slices into `graph-model → impact-analysis → governance-UI → platform-map` via a
`blockedBy` chain; the graph-model slice is itself gated on the introspection-emits-edges prerequisite.
`graduatedTo: webregistries`.

---

**Prepared decision — ratified 2026-06-12 (was: ready to ratify).** No design exists yet; this is the **control plane over
provider↔consumer relationships** that makes Plateau an *enterprise web platform manager* (reframes
[#089](/backlog/089-monetization-product-ideas/) idea 5). Not a package registry — **npm + git stay the
source of bytes**; Plateau tracks *relationships*. The three forks below are grounded in a prior-art survey
published as [`/research/provider-consumer-graph/`](/research/provider-consumer-graph/) (session report
`we:reports/2026-06-12-provider-consumer-graph.md`) covering Backstage's software catalog, consumer-driven
contract testing (Pact), CycloneDX SBOM, and OpenTelemetry service maps. Each fork carries a **bold**
default; the survey surfaced a decisive WE-specific reframe (introspection *is* the graph → the build-time
manifest is auto-derived, not hand-authored).

## The axis

The concern decomposes into three orthogonal axes the item already named: **ingestion** (how the graph is
populated), **seam-contract** (how a contract at each edge is declared), and **home** (WE standard vs
Plateau product). The survey's anchor: **everything in the standard resolves through introspectable
registries, injectors, contexts ([webcontexts](src/_data/projects.json)), and events
([webevents](src/_data/projects.json)) — that introspection *is* the graph.** Backstage requires
hand-authored `we:catalog-info.yaml`; WE can auto-derive the same `providesApis`/`consumesApis` relations
from its own introspection, which removes the staleness that bottlenecks the build-time model elsewhere
and makes "build-first" the natural default. The provider-side contract already exists as **protocol
conformance contracts + tiers** ([we:protocols.json](src/_data/protocols.json)); the seam-contract reuses it
rather than coining a second format.

### Per-fork classification (the 7-question pass, recorded)

- **Layer (Q1):** the *graph model + seam-contract* are a **standard** concern (an introspection schema +
  a contract definition); the *aggregation + UI + governance* are a **product** (Plateau). Split → **Fork 3**.
- **Protocol or not (Q2):** the seam-contract has a genuine cross-vendor interop story (independent
  providers + consumers must agree on the shape at an edge) — a legitimate Protocol. But **reuse the
  existing protocol conformance contract** rather than coin a new one → **Fork 2**.
- **Fixed-vs-dimension (Q4):** ingestion source is a real dimension with legitimate end-states (build-time
  / runtime / both) → expose it; **Fork 1**.
- **Most-permissive default (Q6):** the permissive, lowest-operational-cost default is build-time
  auto-derived (no live agent to run) — runtime is the opt-in enrichment, not the baseline.
- **Seam between concerns (Q7) / separate-and-decouple:** graph-model+contracts (open) split from
  aggregation+governance (licensed) — the standing bias toward two composable homes; the open half is what
  guarantees "nothing to lock into."

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **1 · Ingestion model** | **Both, staged build-first** — build-time manifest auto-derived from WE introspection; runtime agent as later drift-enrichment | Runtime agent as a co-equal first-class source now | Med-high |
| **2 · Seam-contract representation** | **Reuse the protocol conformance contract, recorded bidirectionally** (provider tier + consumer-driven subset projection) | A separate Pact-style contract format dedicated to the graph | High |
| **3 · Home** | **Split** — graph-model + contracts = WE open standard; aggregation + UI + governance = Plateau licensed product | One combined Plateau-side project owning model + product | High |

## Fork 1 — Ingestion model: how is the graph populated?

**Crux:** the item's root fork (split-safety condition 1 — this is *why* #092 couldn't slice). The field
runs two mature patterns with a documented "both" consensus, but WE's introspection changes the economics.

- **A. Build-time export, auto-derived from WE introspection.** Each project emits its
  provider/consumer manifest at build — but unlike Backstage's hand-authored `we:catalog-info.yaml`, WE
  *derives* it from the introspectable registries/injectors/contexts/events. Static, auditable, no live
  agent, and not hand-maintained.
- **B. Runtime agent.** A live agent observes the running platform (OpenTelemetry service-graph model) and
  reports edges. Captures real wiring, but "a map from last month is already wrong," misses uninstrumented
  edges, and is heavier to operate.
- **C. Both, staged build-first.** Build-time auto-derived as the **source of truth**; runtime as **drift
  detection** (edges marked *potential* until trace-confirmed) — the field's explicit recommendation.

**Recommended default: C — both, staged build-first.** Land the build-time auto-derived manifest first
(complete + auditable + nearly free given WE introspection), add the runtime agent later as drift
enrichment. Most-permissive-default points at build-first (no live agent required to get value); the
field consensus is "both." **Confidence: med-high** — the one judgment is *timing*: whether the runtime
agent is in first-cut scope or a deferred follow-on. Recommend deferred (build-time delivers the impact-
analysis product on its own).

*Rejected:* B-as-default (operational weight + staleness for no gain over auto-derived build-time at
first cut).

## Fork 2 — Seam-contract representation

**Crux:** how the contract at each provider↔consumer edge is declared, so drift detection + impact
analysis + verification ([#089](/backlog/089-monetization-product-ideas/) idea 1) all share one
definition. The mature pattern is consumer-driven contract testing (Pact): the consumer records the subset
it depends on; a broker is the source of truth for "safe to deploy together."

- **A. Reuse the protocol conformance contract, recorded bidirectionally.** Provider declares the
  conformance tier it implements ([we:protocols.json](src/_data/protocols.json) already models this); consumer
  declares the dimensions/capabilities subset it depends on (the consumer-driven projection). One
  definition, shared with verification + drift detection.
- **B. A separate Pact-style contract format** dedicated to the graph. *Rejected* — a second contract
  format to keep in sync with the conformance contracts; duplicates what we:protocols.json already defines
  (minimize-lock-in + separate-and-decouple cut the other way here: don't fork a parallel contract).

**Recommended default: A — reuse the protocol conformance contract, recorded bidirectionally.** The
provider side already exists; adding the consumer-driven subset projection is the only new piece, and it
keeps drift detection and #089-idea-1 verification on a single contract definition. High confidence.

## Fork 3 — Home: WE standard or Plateau product?

**Crux:** the item flags this as the same open question MaaS ([#081](/backlog/081-module-as-a-service-provider/))
carries — confirm the home vs graduating a Plateau-side project entry.

- **A. Split per the constellation.** The **graph model + seam-contract definition** are WE **standard**
  concerns (open, self-hostable — this *is* the "nothing to lock into" guarantee, matching the item's own
  framing); the **cross-repo aggregation, the graph UI, and the governance workflows** are the Plateau
  **licensed product**. Same provider-side/aggregation-side split as #081.
- **B. One combined Plateau-side project** owning both model and product. *Rejected* — folds the open
  standard schema into the licensed product, which contradicts the item's "the registries/injectors/contexts
  and their introspection are open and self-hostable" promise and the npm-scope rule (`@webeverything` =
  standard artifacts only).

**Recommended default: A — split.** The open graph-model/contract half is exactly what lets Plateau claim
"npm + git remain the source; nothing to lock into," while the aggregation + governance UI is the licensed
value. High confidence (settled by the constellation + npm-scope doctrine).

---

## What it tracks (beyond DI dependency) — context

Everything in the standard resolves through **introspectable** registries, injectors, contexts, and
events — that introspection *is* the graph. Plateau aggregates it across repos/teams into one live model:
**protocol implementations** (which providers implement which protocols, at which tier), **consumption
edges** (bidirectional — including who depends on *me*), and **contracts at each seam** (the expected shape
on both sides). What it does with the graph: **impact analysis** ("if I change provider X, who breaks?"),
**cross-team contract drift**, **ownership & policy/governance**, and a live **platform map**.

## Revenue & non-lock-in — context

Enterprise license / per-seat platform-manager subscription, strongly bundled with continuous verification
(#089 idea 1 — the graph is what makes "prove my assembled app still holds together" possible). **npm + git
remain the source**; Plateau tracks *relationships*, not packages — the introspection is open and
self-hostable, the licensed product is the cross-repo aggregation + graph UI + governance workflows.

*Graduation (on ratification):* once ingestion (Fork 1) is settled, the item re-slices cleanly into
**graph-model → impact-analysis → governance-UI → platform-map** via a `blockedBy` chain — a prepared
decision yields agent-ready builds, not code itself.
