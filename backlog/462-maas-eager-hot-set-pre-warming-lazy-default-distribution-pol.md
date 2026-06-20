---
kind: story
size: 3
status: resolved
blockedBy: ["461"]
dateOpened: "2026-06-13"
dateStarted: "2026-06-13"
dateResolved: "2026-06-13"
graduatedTo: blocks/renderers/module-service/prewarm.ts
tags: [module-as-a-service, distribution, eager, lazy, pre-warming, hot-set, cache]
parent: "081"
relatedProject: webadapters
---

# MaaS eager hot-set pre-warming + lazy-default distribution policy

Phase (c) of the #087 distribution ruling: make distribution mode a per-artifact policy on the MaaS origin (#461) — default lazy-with-cache-fill, opt into eager pre-warming for a declared hot set (the forms+targets+strategies an author/consumer actually ships, e.g. wc-class@es2020 for prod, declarative for docs). Pre-building the full (form x target x strategy x version) matrix is combinatorial and mostly wasted, so eager-warm only the declared hot set and LOG what was left lazy so coverage is never silently partial. Invalidation follows the immutable-artifact rule: re-point the floating pointer, never purge an immutable artifact.

## Scope

- A per-artifact (or per-consumer) **hot-set declaration**: which `(form, target, strategy)` tuples to pre-resolve at publish time.
- Eager path: resolve + cache-fill the hot set up front (warm the origin/edge); lazy path stays the default for everything else.
- **Log what was left lazy** — emit the un-warmed slice of the matrix so coverage is never silently partial.

## Acceptance

- Declaring a hot set pre-warms exactly those tuples; everything else resolves lazily on first miss.
- A run reports the lazy remainder (count + identities).
- No change to the immutable-artifact invariant (#461): invalidation = re-point the floating pointer only.

## Resolved 2026-06-13 (batch-2026-06-13, cascade top-up after #461)

Built the distribution-policy module on the #461 origin:

- **New [we:blocks/renderers/module-service/prewarm.ts](../blocks/renderers/module-service/prewarm.ts)** —
  `prewarmHotSet(cache, policy, log?)` over the existing `ServedArtifactCache` (#311). A `PrewarmPolicy`
  declares `ids` + a `hotSet` of `(form, target, strategy)` tuples; the eager path resolves +
  cache-fills exactly those through the SAME `cache.serve` a real request uses (so a warmed tuple is a
  genuine later hit, not a parallel pre-render); everything else stays lazy-with-cache-fill (the
  default). Framework-agnostic — injected cache + `log` sink, no Node/Vite imports (same portability
  contract as the handler).
- **Never silently partial** — `prewarmHotSet` always returns (and logs) the `lazyRemainder` (count +
  identities = the full candidate `MatrixSpace` minus the warmed set), and surfaces hot-set tuples that
  hit an unknown id in `unresolved` rather than throwing. `MatrixSpace` defaults to all forms ×
  `esnext` × `declarative-static`; widen `targets`/`strategies` to the project's real compile set.
- **Immutable invariant unchanged** — warming only fills the cache; invalidation stays "re-point the
  floating pointer, never purge an immutable artifact" (the cache's existing `invalidate`).
- **Tests** — [we:prewarm.test.ts](../blocks/__tests__/unit/renderers/prewarm.test.ts) (5 cases): warms
  exactly the hot set, reports the lazy remainder, real cache-fill (later request is a hit), unknown-id
  → `unresolved` (no throw), log summary, default-matrix accounting. Gate green.

**Acceptance met.** Integration seam (follow-up, not blocking): the #461 Fetch handler currently calls
`resolve` directly per request; pointing it at a shared `ServedArtifactCache` would let
`prewarmHotSet` warm the very cache the handler reads — a small wiring change tracked with the hosted
origin work (#451).

**Graduated to** `we:blocks/renderers/module-service/prewarm.ts` — webadapters distribution pre-warm path.
