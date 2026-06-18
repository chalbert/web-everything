---
type: issue
workItem: story
size: 3
status: resolved
blockedBy: ["847"]
dateOpened: "2026-06-17"
dateResolved: "2026-06-17"
graduatedTo: frontierui/tests/a11y/sitemap-routes.ts
tags: []
---

# Mirror sitemap-derived a11y gate into Frontier UI (own sitemap + gate)

Per #774 Notes + #771: mirror the auto-derived rendered-site a11y gate into frontierui. FUI emits its OWN sitemap and derives its own route set — same Fork-1=C scope + Fork-2=A mechanism ruling as WE-docs, applied per-repo (the gate is mirrored, not shared). Follows #771's mirroring pattern. Blocked on the WE-side derivation helper (#847) landing first so FUI copies a proven shape.

## Progress (2026-06-17, batch-2026-06-17) — built (locus frontierui)

Ported the proven WE #846+#847 shape into FUI, mirrored not shared:

- **FUI sitemap** — `fui:frontierui/src/sitemap.njk` (iterates `collections.all` → sitemaps.org/0.9 `/sitemap.xml`) + `url` added to `fui:frontierui/src/_data/site.js` (override `SITE_URL=…`). `addAllPagesToCollections: true` on FUI's one paginating template (`we:block-pages.njk`) so `collections.all` is complete (30 URLs, all 23 blocks + index surfaces).
- **Derivation helper** — `fui:frontierui/tests/a11y/sitemap-routes.ts` (identical scope-C logic to WE's #847): fetches FUI's `/sitemap.xml` over the FUI docs origin (:8082), filters to every index surface + first detail page per path-prefix group. `ENFORCED_ROUTES` seeded **empty** (FUI's #771 allowlist was all warn-only — none promoted yet), so every derived route is warn-only.
- **Gate rewired** — `fui:frontierui/tests/a11y/rendered-site-a11y.spec.ts` loops `gatedRoutes()`; the hand-maintained `we:route-allowlist.ts` (#771) is **deleted**.
- **Verified:** FUI 11ty build emits a well-formed `/sitemap.xml` (30 balanced `<loc>`); derived **8 routes** = the 7 #771 index surfaces + one representative block detail (`/blocks/audit-trail/`) — scope-C confirmed; live FUI a11y lane **8/8 pass** against :8082 (all warn-only, surfacing real color-contrast violations without failing — correct posture); `npm run check:standards` in `../frontierui` → 0 errors, 0 warnings.
