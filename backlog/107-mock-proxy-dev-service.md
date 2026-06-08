---
type: idea
workItem: story
size: 5
status: open
dateOpened: "2026-06-06"
tags: [mocks, proxy, dev-server, contract-testing, http, plateau, tooling, dx, standard]
relatedReport: reports/2026-06-06-front-end-platform-book.md
crossRef: { url: /backlog/099-evergreen-app-vision/, label: "Evergreen app (#099)" }
---

# Mock & service-proxy dev standard — a real HTTP mock/proxy with a console, and no mock code in the app

A development-time **HTTP mock + service-proxy** standard, with the essay's hard rule: **mocks must never live in deployable code** — no `if (mock)` branches anywhere shippable. Instead a real local HTTP server transparently mocks/proxies your APIs, controlled by config + a console, so production builds carry zero mock logic. From the essay's *Mocks* and *Web Service Proxy & Console* sections.

## What the mock service must do

- **Latency injection** — add delay to a specific API or all APIs.
- **Error injection** — trigger exceptions: standard (401) or specific (400 with a chosen body).
- **Conditional responses** — code rules that vary content by path / query / headers.
- **Auth** — including fake OAuth when needed; optionally a session (prefer stateless if avoidable).
- **Real endpoints + reload-from-endpoint + proxy** — mix mocked and live.
- **Tracking & contract enforcement** — monitor calls and **detect contract drift / breach of the API contract**.
- **Configurable** via a JSON file, the dashboard/console, or special query params / headers.

## Service-proxy & console

Point at different backends **without CORS**; turn services on/off and force specific status codes per service (via header, param, or the console). Integrated with the mock console as one surface.

## Why it's in scope

It's a **Plateau dev service** (the essay lists "Dev service (http2)" and a "Web Service Proxy & Console" under Plateau Services), and the **contract-drift detection** ties directly to the conformance/verification thesis (#089 idea 1) and the cross-team contract graph (#092) — a mock that knows the API contract is the dev-time half of "prove the seams still hold." Native-first: lean on the dev server / service worker rather than in-app conditionals.

## Open questions

- Standardize the **mock/contract config schema** (the portable artifact) vs. the server impl — the schema is the standard, the server is a provider.
- Where it lives: a Plateau dev service vs. a standalone tool (tier-1 self-run, per #089's lens). Lean: self-run dev tool first.
- Relationship to **webcases**/contract testing — the same contract that mocks an endpoint should be the one verified against the real service (one contract, two uses: mock + drift check).
