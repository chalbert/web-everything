---
type: issue
workItem: story
size: 3
status: resolved
blockedBy: ["846"]
dateOpened: "2026-06-17"
dateStarted: "2026-06-17"
dateResolved: "2026-06-17"
graduatedTo: tests/a11y/sitemap-routes.ts
tags: []
---

# A11y gate derives route set from sitemap + scope-C sampling

Per #774 Fork-1=C + Fork-2=A: replace the hand-maintained we:route-allowlist.ts (#770) with auto-derivation. Add a helper in tests/a11y/ that fetches /sitemap.xml (#846) over the dev-server origin, then filters to scope-C: every index surface + the first detail page per path-prefix group (one representative sample per *-pages.njk collection-template). The Playwright lane loops the derived set. Removes the hand-edit seam so every published surface is gated without touching a list.

## Progress (2026-06-17, batch-2026-06-17) — built

- **Derivation helper** ([we:tests/a11y/sitemap-routes.ts](../tests/a11y/sitemap-routes.ts)) — `fetchSitemapPaths()` GETs `/sitemap.xml` (#846) over the dev origin and reads its `<loc>` pathnames; `deriveScopeCRoutes()` is the pure scope-C filter: **every index surface** (root + single-segment pages) + **the lexicographically-first detail page per path-prefix group** (one representative sample per `*-pages.njk` collection-template). Sorted + de-duped → deterministic. `gatedRoutes()` falls back to the enforced seed if the fetch fails (no silent zero-route run).
- **Enforce posture preserved (#774 forced invariant):** an explicit `ENFORCED_ROUTES` set seeded with #793/#805's 10 build-blocking index surfaces; a route is enforced iff it's in that set, every newly-derived route enters **warn-only** (most-permissive default), `A11Y_ENFORCE=1` still flips the whole lane.
- **Gate rewired** ([we:tests/a11y/rendered-site-a11y.spec.ts](../tests/a11y/rendered-site-a11y.spec.ts)) to loop `gatedRoutes()`; the hand-maintained `we:route-allowlist.ts` (#770) is **deleted** — a new published surface is now gated with no hand-edit.
- **Verified:** 6 vitest cases on the pure derivation (index-surface keep, one-detail-per-group, deterministic first-pick, normalization, enforced seed) — wired into vitest `include` (`tests/a11y/**/__tests__/**/*.test.ts`; Playwright keeps the `*.spec.ts` lane). Live lane: **29/29 pass** against the running server — derived 29 routes (14 index surfaces + 15 detail samples), the 10 enforced routes green, new warn-only detail pages surface real violations (color-contrast, scrollable-region, document-title) without failing the build. `check:standards` 0 errors.
