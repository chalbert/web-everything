---
type: issue
workItem: story
size: 2
status: resolved
blockedBy: ["847"]
dateOpened: "2026-06-17"
dateStarted: "2026-06-17"
dateResolved: "2026-06-17"
graduatedTo: tests/a11y/sitemap-routes.ts
tags: []
---

# ENFORCED_ROUTES set decoupled from derived set, seeded with #793's enforce posture

Per #774 forced invariant: preserve #793's earned enforce posture under auto-derivation. Add an explicit ENFORCED_ROUTES data set (decoupled from the auto-derived route set of #847) seeded with the build-blocking routes — now 10/10 since #805 resolved. Newly auto-derived routes enter warn-only (most-permissive default), promoted per-route as each goes green. Prevents derivation from silently un-earning enforce:true and reintroducing the silent-regression failure mode.

## Progress (2026-06-17, batch-2026-06-17) — delivered as part of #847

This is the #774 *forced invariant* and is **inseparable** from #847's derivation — landing auto-derivation without it would silently un-earn the 10 enforced routes (the broken alternative #774 named). So it shipped in the same change: [we:tests/a11y/sitemap-routes.ts](../tests/a11y/sitemap-routes.ts) exports an explicit `ENFORCED_ROUTES: ReadonlySet<string>` seeded with the 10 build-blocking index surfaces (`/`, `/intents/`, …, `/backlog/`), **decoupled** from `deriveScopeCRoutes()`; the gate spec computes `enforce = ENFORCED_ROUTES.has(path)`, so every newly-derived route is **warn-only** until individually promoted, and `A11Y_ENFORCE=1` still flips the whole lane. Verified by the #847 unit test ("seeds the 10 #793/#805-enforced index surfaces") and the 29/29 live lane (10 enforced green, new routes warn-only). No separate code change needed.
