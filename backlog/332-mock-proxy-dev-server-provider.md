---
type: idea
workItem: story
size: 8
status: resolved
blockedBy: ["331"]
dateOpened: "2026-06-11"
dateStarted: "2026-06-12"
dateResolved: "2026-06-12"
graduatedTo: frontierui/tools/mock-server (reference mock|proxy|record provider for protocol:mock-contract)
tags: [mock, proxy, dev-service, provider, self-run-tool, cors]
---

# Reference self-run mock/proxy dev-server provider

Build the reference self-run dev-server provider that implements the mock/contract schema (#331): serves mocks from the artifact, proxies/records real traffic, bypasses CORS, and honors per-service toggles and the `mock | proxy | record` response-kind. Ships with the free self-run tier; the hosted broker/history stays the deferred open-core upsell. Ratified in #107 (Fork 2): tier-1 self-run first, matching the solo-founder operational ranking (no hosted uptime/support at concept stage). Blocked on the schema (#331) it implements; parent for the console (#333) and one input to the drift-check (#334).

## Progress

**Resolved 2026-06-12** → `frontierui/tools/mock-server/` (the reference provider; impl lives in Frontier UI per the constellation, never `@webeverything`).

Built a self-contained, framework-free (`node:http`) reference server reading a portable `MockContract` and serving every axis the standard names:

- `we:contract.ts` — the consumer-view types mirroring the `mock-contract` protocol (#331); under-specified axes (predicate language, latency distribution, auth session) flagged `(open question)` with a minimal chosen shape.
- `fui:server.ts` — the provider. **Pure** decision core (`matchRequest`, `matchPath`, `deepPartialMatch`, `resolveInteraction`, `authSatisfied`) split from the I/O so it unit-tests with no sockets; `createMockServer(contract, options)` returns an `http.Server` + a shared `ToggleController`. Covers `mock | proxy | record`, latency (fixed + uniform distribution), fault injection (rate), first-that-matches conditionals, fake-bearer auth, CORS-bypass (incl. 204 preflight), per-service runtime toggle, and forced-status override. All I/O (`rng`, `delay`, `forward`, `onRecord`) is injectable for deterministic tests.
- `fui:cli.ts` — thin runnable entry (`fui:cli.ts <we:contract.json> [--port] [--base]`).
- `fui:example.contract.json` — a contract exercising mock + conditional + fault + auth + proxy.
- `fui:__tests__/server.test.ts` — **24 tests**, the pure matcher/resolver plus the HTTP provider end-to-end across all four axes. Green; `tsc --noEmit --strict` clean.
- `we:README.md` — the behavior-surface table + programmatic and CLI usage.

**Deliberately out of scope (the artifact stays clean):** CORS-bypass / per-service toggle / forced-status are provider-runtime overrides, not part of the portable contract — exactly the #107 ruling. The hosted broker/history is the deferred upsell. Follow-ons remain: the console (#333) writes to the `ToggleController`; the drift-check (#334) replays the same interactions against the real service inside Web Cases.
