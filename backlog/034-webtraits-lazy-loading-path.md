---
type: idea
workItem: task
status: resolved
dateOpened: '2026-06-02'
dateStarted: "2026-06-06"
dateResolved: "2026-06-06"
tags:
  - webtraits
  - lazy-loading
  - build-time
  - code-splitting
  - behaviors
relatedReport: reports/2026-06-02-lazy-traits-loading.md
relatedProject: webtraits
---

# Build the Web Traits lazy-loading path (Map + defineLazy + Enforcer)

traits.json specs 'Scale without Weight' in 3 pillars; pillar 1 (runtime contract) has a POC (Sortable.ts), pillars 2-3 are unbuilt. Three gaps: (1) The Map — an attribute->trait-module manifest (e.g. composesTraits in blocks.json); (2) CustomAttributeRegistry.defineLazy(name, () => import()) so a behavior's code is dynamic-imported on first DOM appearance (copy the Injector's lazy register/consume dedup+cache) — the smallest first prototype; (3) The Enforcer — a Vite plugin that scans templates for trait-attributes, reads the Map, and emits split chunks + defineLazy registrations. The attribute declaration is the single source both build-time and runtime read.

## Resolution (2026-06-06)

All three "Scale without Weight" pillars shipped in **Frontier UI** and proven end-to-end with a live demo. Kept visible (resolved, not deleted) as the trail for this standard's implementation.

- **Gap 2 — `defineLazy` (The Contract → lazy runtime).** `plugs/webbehaviors/CustomAttributeRegistry.ts`: `defineLazy(name, () => import())` registers a loader, unions lazy names into the MutationObserver's `attributeFilter`, dynamic-imports on first DOM sighting (dedup in-flight + cache via `define`, mirroring `Injector.consume`), then upgrades the triggering elements. Loader accepts the class or a module `default`; eager `define` supersedes a pending lazy reg; failed load retries. *9 tests* in `CustomAttributeRegistry.defineLazy.test.ts`.
- **Gap 1 — The Map (standalone trait manifest).** `plugs/webbehaviors/traitManifest.ts`: `TraitManifest = Record<string, LazyAttributeLoader>` + `registerTraits(attributes, manifest)` that `defineLazy`s each entry; wired into `plugs/bootstrap.ts`, exported from the webbehaviors index. *5 tests* in `traitManifest.test.ts`.
- **Gap 3 — The Enforcer.** `tools/trait-enforcer/vite-plugin.ts`: a Vite plugin (mirrors `tools/dev-panel`) that reads the build-time `TraitMap`, scans templates for used trait attributes (`scanTraitsInHtml`), and serves a generated `virtual:trait-manifest` of literal `import()` thunks (`generateManifestModule`) so the bundler code-splits each trait. Wired into `vite.config.mts`; `tools/**` added to `vitest.config.ts`. *14 tests* in `tools/trait-enforcer/__tests__/trait-enforcer.test.ts`.
- **Conformance demo (DoD).** Reference trait `blocks/traits/Sortable.ts` + `demos/lazy-traits.html`/`.ts`: a declared `<ul sortable>` triggers the Enforcer-generated manifest → `defineLazy` → the `Sortable` chunk is fetched **on demand** (verified via Playwright: list sorts asc, click toggles desc, a separate `Sortable` request fires, no errors). Full Frontier UI suite green (1168 passed).
- **Decision captured on the standard page** (not here): "The Map — Materialization Decision" on `/projects/webtraits/` (`src/_data/traits.json` → `map_materialization`, rendered by `src/_includes/project-webtraits.njk`).

**Follow-ups (own items):** global bootstrap → `virtual:trait-manifest` wiring [#116](/backlog/116-bootstrap-consume-trait-manifest/) · default delivery eager-vs-split decision [#032](/backlog/032-trait-delivery-eager-vs-lazy/).
