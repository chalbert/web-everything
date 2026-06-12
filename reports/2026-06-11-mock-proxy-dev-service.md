# Mock & Service-Proxy Dev Service — Prior-Art Survey

**Date:** 2026-06-11
**Grounds:** backlog [#107 — Mock & service-proxy dev standard](../backlog/107-mock-proxy-dev-service.md)
**Related:** [Front-End Platform Book essay](2026-06-06-front-end-platform-book.md) (§ *Mocks*, § *Web Service Proxy & Console*); [`webcases` project](../src/_data/projects.json#L208); [#100 Requirement-as-code](../backlog/100-requirement-as-code.md); [#089 Monetization](../backlog/089-monetization-product-ideas.md)

## The question

The essay (§ *Mocks*, report lines 786–808) lays down a hard rule — **no mock code in any deployable file**; a real local HTTP server transparently mocks/proxies APIs, controlled by a JSON config + a console. Before authoring a standard, this survey gathers prior art so the forks (is the **schema** the standard or the **server**? self-run tier or hosted? what is the relationship to `webcases`?) reuse industry vocabulary instead of coining it. There is no native browser primitive for "intercept and replay HTTP at the dev edge" beyond the Service Worker (which MSW exploits) — so the baseline is a tool, and the only question that produces a *standard* is whether the portable artifact (the mock/contract definition) is normative.

## The field, six tools surveyed

| Tool | Layer | Definition artifact | Portable? | Contract role |
|---|---|---|---|---|
| **MSW** (Mock Service Worker) | Service Worker (browser) / Node interceptor — in-process, no server | JS/TS handlers (`http.get(...)` → `HttpResponse.json()`) | **No** — handlers are code, not data | none (pure mock) |
| **Mockoon** | Standalone local HTTP server (desktop GUI + CLI) | A single **Mockoon JSON** environment file (routes, latency, rules, proxy) | **Yes** — JSON committed to repo | imports OpenAPI; no drift check |
| **Prism** (Stoplight) | Standalone HTTP server (Docker) | **OpenAPI 2/3.0/3.1** spec — mock is *derived*, not authored | **Yes, but it IS OpenAPI** | validation proxy mode (request/response vs spec) |
| **WireMock** | Standalone Java server / Docker / JUnit lib | **Stub mappings** JSON (request match → response, delays, faults, templating) | **Yes** — JSON stub files | record/playback; no consumer contract |
| **Pact** | Test-time broker, not a dev server | **Pact file** (consumer-driven interactions, JSON) | **Yes** — the pact *is* the contract | **the** contract-drift primitive (verify provider against consumer pact) |
| **OpenAPI / JSON-Schema** | (substrate, not a tool) | the spec itself | **Yes** — the lingua franca | provider-driven schema validation; BDCT bridges to Pact |

### Finding 1 — the portable artifact is the only thing that can be a *standard*

Across the field the tools split cleanly into **code-defined** (MSW: handlers are TypeScript, not data — by design, because it lives in the test runner) and **data-defined** (Mockoon, WireMock, Prism: a JSON/spec file you commit). Only the data-defined ones produce something *another* tool could consume. MSW is the warning case: it is the best DX for front-end unit tests precisely *because* it is code, and that same choice makes it non-portable. For WE, whose whole thesis is "minimize lock-in; the protocol is the only lock" ([[feedback_minimize_lock_in_protocol_only_lock]]), the standard must be **the schema, not the server** — the server is a swappable provider, exactly as Mockoon-JSON-vs-WireMock-JSON-vs-OpenAPI are interchangeable *kinds* of definition today. (Grounds Fork 1.)

### Finding 2 — nobody has standardized the schema; each tool reinvented it

Mockoon JSON, WireMock stub mappings, and Prism's "it's just OpenAPI" are **three incompatible dialects** of the same idea (match a request shape → produce a response, with latency/fault/conditional rules). OpenAPI is the closest thing to a shared substrate, but it is provider-driven and describes the *happy-path shape*, not the *mock behaviors* (latency injection, forced 401, per-header conditional bodies) the essay's list demands. So a WE mock schema is **OpenAPI-anchored for the response *shape*, with a behavior layer on top** for the dev-time concerns OpenAPI cannot express. This is the same "borrow official platform vocabulary, add the missing axis" move used elsewhere ([[feedback_intent_ux_only_technical_to_configurator]]). (Grounds Fork 1's sub-decision.)

### Finding 3 — the proxy is a *mode of the same server*, not a separate tool

Mockoon, WireMock, and Prism all ship **proxy/passthrough + record** as a mode of the mock server: requests can be mocked, proxied to a real backend, or recorded for later replay, mixed per-route. The essay's "Web Service Proxy & Console" (lines 804–808) is explicitly "integrated with the Mocks console" — i.e. the same surface. This confirms the proxy is **not a sibling standard**; it is the `proxy`/`passthrough` response-kind in the *one* mock schema (route says `mock | proxy | record`), and the CORS-bypass + per-service on/off + forced-status are console/header/param overrides on that schema. (Confirms the item's instinct to integrate; no separate fork needed — folded into Fork 1's schema scope.)

### Finding 4 — delivery: every survivor leads with self-run; hosted is the upsell

The dominant, free, and most-adopted forms are **self-run**: MSW (a library), Mockoon (offline-first desktop + CLI), WireMock (JAR/Docker), Prism (Docker). The **hosted** offerings (WireMock Cloud, Stoplight, PactFlow) are commercial layers *on top of* the same open artifact — they sell collaboration, history, and the contract *broker*, not the mocking itself. This is textbook open-core and maps directly onto the solo-founder operational ranking (self-run tool > single service > hosted) in [#089](../backlog/089-monetization-product-ideas.md) / [[project_monetization_strategy]]: **ship the tier-1 self-run dev tool first**, leave a hosted broker as a deferred upsell. The hard constraint is the uptime/support burden of a hosted service, which a solo founder should not take on at concept stage. (Grounds Fork 2.)

### Finding 5 — "one contract, two uses" is real, and Pact names it

The essay's third open question — *the same contract that mocks an endpoint should be verified against the real service* — is **exactly** consumer-driven contract testing. Pact's whole model is: the consumer's expectations (the same interactions you'd mock) become the **pact**, which is then **verified against the provider** to detect drift. The industry is converging on **Bi-Directional Contract Testing (BDCT)**: use an existing OpenAPI spec as the provider contract and verify it against consumer pacts, unifying schema-validation and contract-testing in one workflow ([PactFlow BDCT](https://pactflow.io/blog/schemas-can-be-contracts/)). The crucial nuance the survey surfaces: **schema validation ≠ contract verification.** A schema proves a payload's *shape* conforms; it does **not** prove a real consumer depends on a field, nor that the provider honors a specific interaction. So "mock and drift-check from one artifact" is achievable, but the artifact must carry *interactions* (consumer-driven), not just a *shape* (OpenAPI). This is the seam to `webcases` — the webcases suite is already "the machine-checkable target / source of truth for conformity" ([#100](../backlog/100-requirement-as-code.md#L26); [`webcases` project](../src/_data/projects.json#L208)). (Grounds Fork 3.)

### Finding 6 — there is no native tree to lean on; the SW is the closest primitive

Unlike, say, `<select><optgroup>` for droplists, there is **no** web-platform primitive for dev-time HTTP interception except the **Service Worker** (which MSW uses in-browser) and the dev server itself. Native-first here means: prefer a real dev HTTP server / SW over `if (mock)` branches in app code (the essay's hard rule), not "there's a built-in we degrade to." So the WE mock standard is necessarily a tool + schema; the "native" alignment is *the deployment shape* (out-of-process, zero shippable mock logic), not an API.

## Forks this survey grounds (see [#107](../backlog/107-mock-proxy-dev-service.md))

1. **Schema-as-standard vs tool-specific** → the **schema is the standard, the server is a provider** (Findings 1–3). Sub-decision: OpenAPI-anchored response shape + a WE behavior layer for latency/fault/conditional/proxy.
2. **Delivery tier** → **tier-1 self-run dev tool first**, hosted broker deferred (Finding 4).
3. **Relationship to `webcases`** → **one contract, two uses**, but the contract must carry consumer *interactions* (Pact/BDCT), not just an OpenAPI shape — the webcases suite is the verification home (Finding 5).

## Sources

- [Mockoon vs MSW comparison](https://mockoon.com/compare/mock-service-worker/) · [Mockoon comparison hub](https://mockoon.com/compare/)
- [MSW comparison docs](https://mswjs.io/docs/comparison/)
- [WireMock stubbing](https://wiremock.org/docs/stubbing/) · [WireMock JSON response templating](https://docs.wiremock.io/response-templating/json)
- [API mocking tools compared (ASOasis)](https://asoasis.tech/articles/2026-04-05-0252-api-mocking-tools-comparison/) · [BrowserStack API simulation comparison](https://www.browserstack.com/guide/api-simulation-tools-comparison)
- [PactFlow — Schemas Can Be Contracts (BDCT/Drift)](https://pactflow.io/blog/schemas-can-be-contracts/) · [Pact vs OpenAPI (Speakeasy)](https://www.speakeasy.com/blog/pact-vs-openapi)
- [What is API contract testing (Total Shift Left)](https://totalshiftleft.ai/blog/what-is-api-contract-testing) · [Pact docs — Convince me](https://docs.pact.io/faq/convinceme)
