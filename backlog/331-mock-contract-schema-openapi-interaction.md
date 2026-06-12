---
type: idea
workItem: story
size: 8
status: resolved
dateOpened: "2026-06-11"
dateStarted: "2026-06-12"
dateResolved: "2026-06-12"
graduatedTo: protocol:mock-contract
tags: [mock, proxy, contract, openapi, dev-service, schema, webcases]
---

# Author the OpenAPI-anchored, interaction-bearing mock/contract schema (the standard artifact)

Author the portable mock/contract schema that is the standard artifact for the mock/proxy dev-service: anchor the response shape on OpenAPI, then add a WE behavior layer for what OpenAPI cannot express — latency, fault injection, conditional responses, a `mock | proxy | record` response-kind, and auth/fake-OAuth. Crucially the artifact is **interaction-bearing** (Pact/BDCT-style consumer interactions), not OpenAPI-shape-only, since schema-validation is not contract-verification. Ratified in #107 (Forks 1 & 3): only a data-defined artifact is portable ("the protocol is the only lock"), and one contract serves two uses (mock + drift-check). Parent build for the server (#332) and drift-check (#334).

## Progress

**Status:** resolved 2026-06-12 → `protocol:mock-contract`.

Authored the **Mock Contract** protocol as a conformance-only standard owned by the **Web Cases** project (the verification home per #107 fork 3):

- `src/_data/protocols.json` — new `mock-contract` entry (`ownedByProject: webcases`, `anchor: protocol-mock-contract`).
- `src/_includes/project-webcases.njk` — created the Web Cases project page (mission + feature-surface table + normative `#protocol-mock-contract` body + composition + status). The schema interfaces (`MockContract` / `Interaction` / `ResponseSpec` / `BehaviorLayer` / `FaultInjection` / `ConditionalRule`) are contracts-only per design-first; concrete servers are providers.
- `src/_data/semantics.json` — added terms: Mock Contract, Consumer Interaction, Response-Kind, Contract Drift.

Design faithful to the ratified forks: OpenAPI-anchored response shape; WE behavior layer (latency / fault / first-that-matches conditionals / `mock|proxy|record` response-kind / stateless-by-default auth); interaction-bearing so one contract drives the mock **and** the webcases drift-check (schema-validation ≠ contract-verification); proxy is a response-kind, not a sibling standard; runtime overrides (CORS-bypass, per-service toggle, forced status) stay out of the portable artifact. Open questions (conditional-rule predicate language, case-format reuse, latency-distribution vocabulary) carried into the Status section.

Follow-on builds remain: reference server (#332), console (#333), drift-check (#334).
