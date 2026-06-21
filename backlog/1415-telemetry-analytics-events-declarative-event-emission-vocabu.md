---
kind: decision
size: 3
parent: "099"
status: open
dateOpened: "2026-06-21"
tags: [decision, book-candidate, telemetry, analytics, cross-cutting, gap]
---

# Telemetry / analytics events — declarative event-emission vocabulary standard: placement

Surfaced by the app-infrastructure cross-cutting lens
([#1402](/backlog/1402-discovery-lens-app-infrastructure-cross-cutting-concerns-inv/)): every product app
emits **analytics / telemetry events** (track a click, an impression, a funnel step) against a swappable
sink (GA / Segment / Amplitude / an on-device collector). WE already has a
`we:src/_data/semantics/analytics-event-vocabulary.json` **glossary term** but **no intent/block** — a
partial: the concept is named, the standard is unbuilt.

Distinct from the audit family ([decision-trace](../src/_data/intents/decision-trace.json) /
[audit-timeline](../src/_data/intents/audit-timeline.json)), which records *governance/decision* history,
not product-analytics events. The pattern is a **declarative event-emission contract**: annotate an element
(`data-track` / an emitter behavior) with an event name + payload from a controlled vocabulary, routed to a
swappable provider — exactly the runtime-DI provider seam (#052/#081) the other infra concerns use.

**Decision (placement-unsure ⇒ decision):** a `telemetry`/`analytics-event` intent (UX-declared: this
element emits event E on interaction I) + a swappable sink provider **vs** a pure behavior/provider with no
intent **vs** folding it under a broader "observability" intent alongside the experiment-exposure events
from [#1414](/backlog/1414-feature-flags-experiments-declarative-gating-variant-assignm/) (they share the
emit-to-a-sink shape). Refs:
[we:src/_data/semantics/analytics-event-vocabulary.json](../src/_data/semantics/analytics-event-vocabulary.json),
[we:src/_data/intents/decision-trace.json](../src/_data/intents/decision-trace.json). **Needs `/prepare`.**
Unsure ⇒ decision; costs nothing.
