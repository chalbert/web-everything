---
kind: story
size: 5
parent: "1684"
status: resolved
dateOpened: "2026-06-23"
dateStarted: "2026-06-24"
dateResolved: "2026-06-24"
graduatedTo: 1684
tags: []
---

# webrouting serializable route-map projection schema + conformance vectors

Define the serializable route-map projection schema ratified in #1685: a JSON shape DERIVED from RouteDefinition (path, guard, guardLeave, loader, outlet, isErrorBoundary) that drops the non-serializable pattern + template. Ship it as an internal WE schema plus conformance vectors — statically-authored routes only, route templates not concrete URLs. The derived-map BUILDER is not this slice; it folds into the first consuming slice (#1688 sitemap). Authorable now (decision resolved, no blocker). Graduated from the #1685 ratification (DOM is the authoring SoT, this is its derived projection).

## Progress (batch-2026-06-23-1725-1665)

Slice B landed — the serializable route-map projection schema + validator + conformance vectors:

- `we:blocks/router/route-map.ts` — the `RouteMapEntry` / `RouteMap` schema (the #1685 derived projection: a 1:1 drop of `RouteDefinition`'s non-serializable `pattern` + `template`, keeping exactly `path`/`guard`/`guardLeave`/`loader`/`outlet`/`isErrorBoundary`) plus a structural `validateRouteMap()` / `isRouteMap()` author-validate pair. Flat ordered list (first-match-wins), faithful to `parseRouteDefinitions` — outlets are named, not nested. `path` is enforced as a URLPattern *template*, never a concrete URL.
- `we:blocks/router/__fixtures__/route-map-cases.ts` — 9 conformance vectors (statically-authored maps): positives (flat table, all-fields, empty) + negatives pinning each rejection (leaked `pattern`/`template`, concrete URL, missing path, wrong type, non-array routes).
- `we:blocks/__tests__/unit/route-map.test.ts` — schema conformance suite (11 tests, green) incl. a JSON round-trip proving serializability.
- Exported from `we:blocks/router/index.ts`.
- Corrected the slice-A spec page (`we:src/_includes/project-webrouting.njk`) to the flat schema (dropped the speculative `children?`/tree framing; added the `RouteMap` wrapper) so the codified contract matches.

The derived-map **builder** (DOM `RouteDefinition[]` → `RouteMap`) is deliberately NOT here — per build-only-when-a-consumer-exists it folds into #1688 (sitemap). One conforming router exists today, so this stays an internal schema + vectors; a `CustomRouteMap` protocol is minted only on a second independent impl. Graduated from the #1685 ratification.
