---
type: decision
workItem: story
size: 5
status: resolved
dateOpened: "2026-06-06"
dateStarted: "2026-06-11"
dateResolved: "2026-06-11"
graduatedTo: none
tags: [mocks, proxy, dev-server, contract-testing, http, plateau, tooling, dx, standard]
relatedReport: reports/2026-06-11-mock-proxy-dev-service.md
preparedDate: "2026-06-11"
crossRef: { url: /backlog/099-evergreen-app-vision/, label: "Evergreen app (#099)" }
---

# Mock & service-proxy dev standard — a real HTTP mock/proxy with a console, and no mock code in the app

A development-time **HTTP mock + service-proxy** standard, with the essay's hard rule: **mocks must never live in deployable code** — no `if (mock)` branches anywhere shippable. Instead a real local HTTP server transparently mocks/proxies your APIs, controlled by config + a console, so production builds carry zero mock logic. From the essay's *Mocks* and *Web Service Proxy & Console* sections. **No design exists yet.** The three forks below — where the standard's line sits (schema vs server), delivery tier, and the `webcases` relationship — are grounded in the published [Mock & Service-Proxy Dev Service](/research/mock-proxy-dev-service/) survey, each naming a **bold** default.

## What the mock service must do (from the essay, preserved)

- **Latency injection** — add delay to a specific API or all APIs.
- **Error injection** — trigger exceptions: standard (401) or specific (400 with a chosen body).
- **Conditional responses** — code rules that vary content by path / query / headers.
- **Auth** — including fake OAuth when needed; optionally a session (prefer stateless if avoidable).
- **Real endpoints + reload-from-endpoint + proxy** — mix mocked and live.
- **Tracking & contract enforcement** — monitor calls and **detect contract drift / breach of the API contract**.
- **Configurable** via a JSON file, the dashboard/console, or special query params / headers.
- **Service-proxy & console** — point at different backends **without CORS**; turn services on/off and force specific status codes per service (via header, param, or the console), integrated with the mock console as one surface.

## Why it's in scope (preserved)

It's a **Plateau dev service** (the essay lists "Dev service (http2)" and a "Web Service Proxy & Console" under Plateau Services), and the **contract-drift detection** ties directly to the conformance/verification thesis ([#089](/backlog/089-monetization-product-ideas/) idea 1) and the cross-team contract graph ([#092](/backlog/092-provider-consumer-graph-platform-manager/)) — a mock that knows the API contract is the dev-time half of "prove the seams still hold." Native-first: lean on the dev server / service worker rather than in-app conditionals.

## Axis framing

The survey collapses the essay's grab-bag into three real forks. **Where the standard's line sits** is the load-bearing one: across the field, tools split into *code-defined* (MSW — handlers are TypeScript, non-portable by design — [mswjs.io/docs/comparison](https://mswjs.io/docs/comparison/)) and *data-defined* (Mockoon JSON, WireMock stub mappings — [wiremock.org/docs/stubbing](https://wiremock.org/docs/stubbing/), Prism's OpenAPI), and only the data-defined ones produce a portable artifact another tool can consume — exactly the lock-in posture WE already takes ("the protocol is the only lock"). The **proxy is not a separate fork**: every survivor ships proxy/passthrough/record as a *mode* of the same server, and the essay says "integrated with the Mocks console" (report [line 808](../reports/2026-06-06-front-end-platform-book.md)) — so it folds into the schema's response-kind. **Delivery tier** mirrors the open-core split every survivor uses (self-run free, hosted broker commercial), which maps onto the solo-founder operational ranking in [#089](/backlog/089-monetization-product-ideas/). **The `webcases` relationship** is the third question: the [`webcases` project](../src/_data/projects.json#L208) is already "the machine-checkable source of truth for conformity" ([#100:26](/backlog/100-requirement-as-code/)), and Pact/BDCT ([pactflow.io](https://pactflow.io/blog/schemas-can-be-contracts/)) name the "one contract, two uses" move precisely — with the nuance that schema-validation ≠ contract-verification.

### Recommended path at a glance

Ratify all three rows, or override just the one you'd change. The **confidence** column says where judgment is actually needed vs. where to nod.

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **1 · where's the standard** | the **mock/contract schema** is the standard; server is a provider (OpenAPI-anchored shape + behavior layer) | server impl as the standard *(rejected)* | **High** — minimize-lock-in + 3-tool data-defined precedent |
| **2 · delivery tier** | **tier-1 self-run dev tool first**; hosted broker deferred | lead with a hosted service | **High** — every survivor is self-run-first; solo-founder lens |
| **3 · webcases relationship** | **one contract, two uses** — mock + drift-check from one artifact, verified in `webcases`; artifact carries consumer *interactions* (Pact/BDCT), not just a shape | mock schema and contract suite stay separate | **Med-high** — schema-validation ≠ contract-verification is the live nuance |

## Fork 1 — where does the standard's line sit: schema or server?

The field splits cleanly. **Code-defined** mocks (MSW: handlers are `http.get(...)` → `HttpResponse.json()` in TypeScript) are best-in-class DX *because* they're code, and non-portable for the same reason — [mswjs.io/docs/comparison](https://mswjs.io/docs/comparison/). **Data-defined** mocks (Mockoon JSON, [WireMock stub mappings](https://wiremock.org/docs/stubbing/), Prism's OpenAPI) commit a JSON/spec another tool could consume — but they are *three incompatible dialects* of the same match-request→produce-response idea. OpenAPI is the closest shared substrate yet is provider-driven and describes the happy-path *shape*, not the dev-time *behaviors* (latency, forced 401, per-header conditional bodies) the essay demands.

- **(A — recommended) The mock/contract schema is the standard; the server is a provider.** Anchor the response *shape* on OpenAPI; add a WE **behavior layer** (latency / fault / conditional / `mock | proxy | record` response-kind) on top for what OpenAPI cannot express. The proxy/CORS-bypass/per-service-toggle are console+header+param overrides on that one schema, not a sibling standard. Matches "the protocol is the only lock"; borrows official vocabulary (OpenAPI) and adds the missing axis. Cost: authoring the schema + a reference server provider.
- **(B) The server impl is the standard.** Cheaper to ship one blessed tool, but it is lock-in for no gain — the moment a second impl exists there is nothing portable between them, and the essay's whole posture is dev-tools = zero lock-in. **Rejected.**
- ***Rejected — pure code-defined (MSW-style).*** Great DX, but produces no portable artifact, so there is no *standard* to author and no shared contract for Fork 3 to verify against.

## Fork 2 — delivery tier: self-run or hosted?

Every survivor leads with a **self-run** form — MSW (library), Mockoon (offline-first desktop + CLI), WireMock (JAR/Docker), Prism (Docker). The **hosted** offerings (WireMock Cloud, Stoplight, PactFlow) are commercial layers on top of the *same open artifact* — they sell collaboration, history, and the contract *broker*, not the mocking itself. Textbook open-core.

- **(A — recommended) Tier-1 self-run dev tool first; hosted broker deferred.** Maps directly onto the solo-founder operational ranking (self-run tool > single service > hosted) in [#089](/backlog/089-monetization-product-ideas/) — the open-core monetization strategy (defer live-serve). A solo founder should not take on hosted uptime/support at concept stage; the open self-run tool is what proves the schema.
- **(B) Lead with a hosted service.** Faster path to revenue and to the cross-team contract *broker* value, but front-loads exactly the uptime/support burden the monetization lens defers. **Rejected for now** (revisit once the self-run tool + schema land).
- ***Rejected — bundle the console as a paid-only surface.*** The console is core to the essay's "configurable via the dashboard"; gating it would cripple the free self-run tier. Console ships with the self-run tool; the *broker/history* is the upsell.

## Fork 3 — relationship to `webcases`: one contract or two?

The essay's open question — the same contract that mocks an endpoint should be verified against the real service — is **consumer-driven contract testing**. [Pact](https://docs.pact.io/faq/convinceme) turns the consumer's expectations (the same interactions you'd mock) into a *pact* verified against the provider to detect drift; the industry converges on **[Bi-Directional Contract Testing](https://pactflow.io/blog/schemas-can-be-contracts/)** (OpenAPI as provider contract + consumer pacts). The [`webcases` project](../src/_data/projects.json#L208) is already "the machine-checkable source of truth for conformity" ([#100:26](/backlog/100-requirement-as-code/)).

- **(A — recommended) One contract, two uses** — the artifact that mocks an endpoint is the same one verified against the real service for drift; `webcases` is the verification home. **Crucial nuance:** the artifact must carry consumer *interactions* (Pact/BDCT), **not just an OpenAPI shape** — schema-validation proves a payload's shape, *not* that a real consumer depends on a field or that the provider honors an interaction. So Fork 1's schema must be interaction-bearing for this to hold.
- **(B) Keep mock schema and contract suite separate.** Simpler initial scope, but discards the survey's strongest finding (the mock *is* the contract) and re-creates the "mocks drift unless governed by verified contracts" failure the field warns about. **Rejected.**
- ***Rejected — OpenAPI-shape-only drift check.*** Tempting because the schema is already OpenAPI-anchored, but shape-conformance ≠ contract-verification; it would report green while a real consumer dependency silently broke.

## Open questions (deferred to authoring, after forks ruled)

- Exact behavior-layer field set on top of OpenAPI (latency / fault / conditional-rule expression language; `mock|proxy|record` per-route; auth/fake-OAuth shape; stateless-vs-session).
- Console surface scope (config editor + call monitor + per-service toggles) — which `webeverything`/`frontierui` layer it ships in.
- Whether the interaction-bearing artifact reuses an existing `webcases` case format or defines a thin superset.

## Resolution — ratified 2026-06-11

- **Fork 1 — the mock/contract schema is the standard; the server is a swappable provider**: anchor the response shape on OpenAPI and add a WE behavior layer (latency / fault / conditional / `mock|proxy|record` response-kind) for what OpenAPI cannot express; proxy/CORS-bypass/per-service toggles are overrides on that one schema. Only a data-defined artifact is portable — "the protocol is the only lock."
- **Fork 2 — tier-1 self-run dev tool first; hosted broker deferred**: every survivor leads self-run and sells the broker/history as the open-core upsell; the console ships with the free self-run tier. Matches the solo-founder operational ranking — no hosted uptime/support at concept stage.
- **Fork 3 — one contract, two uses, tied to `webcases`**: the artifact that mocks an endpoint is the same one verified against the real service for drift, with `webcases` as the verification home; the artifact must be **interaction-bearing** (Pact/BDCT), not OpenAPI-shape-only, since schema-validation ≠ contract-verification — so Fork 1's schema carries consumer interactions.

`graduatedTo: none` — the rulings define the build of a new dev-service + schema, not graduation into one existing entity; the schema/server/console are follow-on builds, and verification lands in `webcases`.

**Follow-on builds (not yet scaffolded):**

- Author the mock/contract schema: OpenAPI-anchored shape + interaction-bearing behavior layer (latency/fault/conditional, `mock|proxy|record`, auth/fake-OAuth) · feature/L · blockedBy: none. → #331
- Reference self-run dev server provider implementing the schema (mock + proxy/CORS-bypass + per-service toggles) · feature/L · blockedBy: schema (#331). → #332
- Mock console surface (config editor + call monitor + per-service toggles) · feature/M · blockedBy: server (#332). → #333
- Drift-check: verify the interaction-bearing artifact against the real service inside `webcases` · feature/M · blockedBy: schema, server (#331, #332). → #334

## Progress

**Status:** resolved 2026-06-11 — all three forks ratified to their bold defaults. Originally forks prepared 2026-06-11; survey published in `relatedReport`. Building the server + console + drift check is the remaining work once the three forks are ruled.
