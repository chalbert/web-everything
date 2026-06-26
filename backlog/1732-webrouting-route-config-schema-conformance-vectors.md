---
kind: story
size: 5
parent: "1684"
status: resolved
dateOpened: "2026-06-24"
dateStarted: "2026-06-26"
dateResolved: "2026-06-26"
graduatedTo: 1684
tags: []
---

# webrouting route-config schema + conformance vectors

Build the webrouting route-config schema (the #1687 ruling's serializable settings) and its WE conformance vectors. The schema admits every route-config setting with merit + real-app use, placed by serializability: app-global deploy-shaped settings (base, history mode, prerender, 404 fallback, trailing-slash, redirects/aliases, locale-prefix, case-sensitivity) as webeverything.config.* fields; per-route settings (lazy, scroll policy) as route-entry fields; a named vocabulary unifies the router block's already-owned base/scroll/lazy. Conformance vectors lock the shape, presentation-free, for any conforming generator. Code-shaped forms (scrollBehavior fn, per-route import) stay on the block, out of scope.

## Progress

Done (resolved 2026-06-26). Mirrors the slice-B route-map pattern (schema + dependency-free structural validator + static conformance vectors + vitest):

- `we:blocks/router/route-config.ts` — the schema. App-global `RouteConfig` (`base`, `history` browser/hash/memory, `prerender`, `notFound`, `trailingSlash`, `redirects[]`, `localePrefix`, `caseSensitive`) + per-route `RoutePolicy` (`lazy`, `scroll`). Two structural validators (`validateRouteConfig` / `validateRoutePolicy`, + boolean forms) pinning the two load-bearing #1687 invariants: **scope partition** (per-route key ⊥ app-global config and vice-versa) and **serializable-only** (a `scrollBehavior` fn / `import()` thunk is rejected — code form stays on the block). Native-first / default-less core; the enumerated set is open-by-design.
- `we:blocks/router/__fixtures__/route-config-cases.ts` — 11 app-global + 5 per-route presentation-free vectors (positive + negative, the negatives pinning each rejection).
- `we:blocks/__tests__/unit/route-config.test.ts` — runs the validators over the vectors. 18/18 green.

History-mode transport (browser/hash/memory) carries the #1686 URL-persistence disambiguation in its docs. The plateau Configurator domain (one card per setting) stays a deferred downstream build per #1687.
