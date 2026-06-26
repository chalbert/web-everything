---
kind: story
size: 5
parent: "142"
status: parked
parkedReason: maturityGated
maturityTrigger: externalConsumers>=1
locus: plateau-app
dateOpened: "2026-06-23"
tags: []
---

# Declared-conformance PR gate (standard-aware review, CI surface)

Slice A of the standard-aware review assistant (#1640, ratified go): a diff-aware gate that holds changed files against the project's declared contracts/intents/rules and fails a PR on conformance drift, run over the example apps. Mirrors the existing plateau:scripts/check-render-conformance.mjs ratchet pattern; scoped as the review-time lens over the #095 conformance core, not a second engine. Reads the per-app declared-rule registry (#1689). Home plateau:conformance-engine.

> **Pre-flight (batch-2026-06-26-1732-1696) — no consumer + undefined drift; deferred unbuilt.** The #1689 `DeclaredRuleRegistry` substrate exists (resolved), but **no app declares any rules** — `registry.register(...)` is called only inside #1689's own test, never by an example app, so the gate has a zero-rule input set and `coverage()` is trivially `1` everywhere (it would gate over nothing, or force inventing a per-app rule-declaration convention no one uses). The "conformance drift" predicate is also under-specified vs the `check-render-conformance` precedent (which has immediate real data: auto-discovered `@frontierui`-importing files). Per *verify-the-mechanism-has-a-consumer*, this is build-when-it-earns-its-keep: ready to build the instant the first example app declares rules (the consumer) **and** the drift predicate is pinned. Released unbuilt — not claimed-and-built.
