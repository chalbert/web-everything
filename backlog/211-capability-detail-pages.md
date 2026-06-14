---
type: idea
workItem: story
size: 3
parent: "203"
status: resolved
dateOpened: "2026-06-08"
dateStarted: "2026-06-09"
dateResolved: "2026-06-09"
graduatedTo: "src/capability-pages.njk (per-capability detail pages at /capabilities/{id}/)"
tags: [capability-provider, capability-vocabulary, catalog, detail-page, baseline, native-first]
crossRef: { url: /backlog/204-capability-vocabulary-provider-interface-matrix/, label: "Extends the /capabilities/ catalog landed in #204" }
---

# Per-capability detail pages at /capabilities/{id}/

[#204](/backlog/204-capability-vocabulary-provider-interface-matrix/) shipped the `/capabilities/`
catalog as a single matrix page (impls × capabilities → tier) plus an intent→capabilities list.
Intents get per-item pages (`/intents/{id}/`); capabilities currently do **not**. A per-capability
detail page would close the catalog symmetry and give each Baseline / `web-features` id a stable,
linkable home.

## Scope

A paginated `capability-pages.njk` (mirroring `intent-pages.njk`) rendering `/capabilities/{id}/`, each
showing:

- The capability's label, `web-features` key, Baseline status, polyfillability class, and summary.
- **Its row of the build-matrix** — the tier on every impl, with the same 3-state colour legend.
- **Which intents require it** (reverse of the `requiresCapabilities` mapping) — linked back to
  `/intents/{id}/`.
- A link out to the `web-features` / Baseline / caniuse entry for the underlying platform feature.

Make the catalog tiles on `/capabilities/` link to these detail pages (today they're static rows).

## DoD

`check:standards` green; `/capabilities/{id}/` resolves for every capability id; the detail page shows
the matrix row + requiring intents; the catalog rows link to the detail pages. Remember to add the
new route to the Vite proxy allowlist (see [#210](/backlog/210-catalog-authoring-vite-proxy-allowlist/)).

## Progress

- **Status:** resolved
- **Branch:** docs/standard-authoring-workflow
- **Done:**
  - Added [src/capability-pages.njk](src/capability-pages.njk) — paginated over `capabilities`, permalink `capabilities/{id}/`, mirroring `intent-pages.njk`. Renders label, `web-features` key, Baseline status, polyfillability class, summary; the capability's **build-matrix row** (tier per impl, 3-state colour legend); **intents that require it** (reverse of `requiresCapabilities`, linked to `/intents/{id}/`); and out-links to webstatus.dev + caniuse keyed by `webFeaturesKey`.
  - Made the `/capabilities/` matrix rows link to the detail pages (the capability-id cell in [src/capabilities.njk](src/capabilities.njk)).
  - Vite proxy: no change needed — `capabilities` is already in the allowlist regex (`vite.config.mts:91`), which matches `/capabilities/{id}/`. Verified live: `GET :3000/capabilities/customizable-select/` → 200.
- **Verified:** `check:standards` green (0 errors); 11ty writes all 14 `/capabilities/{id}/` pages; live page shows matrix row (capability-hard on `face`, native-ok on `base-select`) + requiring intent (`selection`) + webstatus.dev link; catalog rows now link out.
- **Next:** none — DoD met.
