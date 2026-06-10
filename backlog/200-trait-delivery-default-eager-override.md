---
type: idea
workItem: story
size: 3
status: resolved
dateOpened: "2026-06-08"
dateStarted: "2026-06-08"
dateResolved: "2026-06-08"
graduatedTo: "Trait `delivery` dimension — frontierui traitManifest.ts (eager entry) + trait-enforcer + webeverything traits.json/project-webtraits.njk spec + Highlight.ts demo"
tags: [webtraits, lazy-loading, build-time, enforcer, manifest, policy]
relatedReport: reports/2026-06-02-lazy-traits-loading.md
relatedProject: webtraits
---

# Implement the trait `delivery` dimension — default lazy, per-trait `eager` override

Per the [#032](/backlog/032-trait-delivery-eager-vs-lazy/) ruling, trait delivery is a per-trait
configurable dimension (`delivery: eager | lazy`) with **`lazy` as the default**. The lazy
machinery already shipped in [#034](/backlog/034-webtraits-lazy-loading-path/) (`defineLazy`,
the trait manifest, the Enforcer plugin), but the manifest is lazy-only today
(`TraitManifest = Record<string, LazyAttributeLoader>`), there is no `eager` flag, and the default
policy isn't documented in the spec. This item builds the override and documents the default.

**Scope:**

- **Manifest shape** — extend the trait-manifest entry so a trait can declare `eager` (the trait
  author owns the flag). `plugs/webbehaviors/traitManifest.ts`: an entry may be either a lazy loader
  (today's shape, = `delivery: lazy`) or an eager registration (`delivery: eager`). `registerTraits`
  `define`s eager entries up front and `defineLazy`s the rest. The runtime already lets an eager
  `define` supersede a pending lazy reg, so this is mostly a manifest/wiring change.
- **Enforcer** — when emitting from the Map, default to a split chunk + `defineLazy` (lazy);
  for an `eager` trait, bake the import into the main bundle instead of splitting.
- **Spec** — document the `delivery` dimension (default lazy, `eager` override, the
  progressive-enhancement rationale for the default) in `src/_data/traits.json` and its
  description page so the policy is discoverable, not folklore.
- **Conformance demo (DoD)** — extend the existing lazy-traits fixture so one trait is declared
  `eager` (in the main bundle, no separate request) and another stays lazy (separate on-demand
  request), proving both branches of the dimension. Re-run `check:standards`; Frontier UI suite green.

**Note:** a per-*usage* (page-author) override of a trait's manifest-level default is explicitly
deferred per #032 — not in this item's scope.

## Resolution (2026-06-08)

The trait `delivery` dimension shipped — **default `lazy`, per-trait `eager` override** — per the
#032 ruling. Spec documented in webeverything; machinery + demo in Frontier UI.

- **Manifest shape (`frontierui plugs/webbehaviors/traitManifest.ts`).** A manifest entry is now
  `TraitManifestEntry = LazyAttributeLoader | EagerTraitEntry`: a bare `() => import()` loader =
  `delivery: lazy` (today's shape, the default); `{ delivery: 'eager', attribute: Class }` = eager.
  `registerTraits` `define`s eager entries up front (class already in the main bundle) and
  `defineLazy`s the rest. Backward-compatible — existing function entries are unchanged.
- **Enforcer (`frontierui tools/trait-enforcer/vite-plugin.ts`).** `TraitMap` values may be a bare
  string (= lazy) or `{ module, delivery }`. `generateManifestModule` emits a hoisted static
  `import` + `{ delivery: 'eager', attribute }` entry for eager traits (baked into the main bundle,
  no split chunk) and a literal `() => import()` thunk for lazy ones (split + on-demand).
- **Spec (`webeverything src/_data/traits.json` + `project-webtraits.njk`).** New *The Delivery
  Dimension* section documents default lazy, the eager override, and the progressive-enhancement
  rationale; the stale "default delivery is still open" note on *The Map* decision now points to it.
- **Conformance demo (DoD).** New eager reference trait `frontierui blocks/traits/Highlight.ts`;
  `demos/lazy-traits.{html,ts}` and `demos/lazy-traits-plugged.{html,ts}` now exercise both branches
  — `highlight` (eager, main bundle, applied synchronously on `upgrade`) and `sortable` (lazy,
  separate on-demand chunk). Wired into `vite.config.mts`.
- **Tests.** +4 `traitManifest.test.ts` (eager sync-apply, no-loader, mixed eager/lazy), +5
  `trait-enforcer.test.ts` (eager codegen: hoisted static import, lazy stays `import()`, usage scan);
  `plugged-traits.spec.ts` e2e extended to assert the eager `data-highlight-ready` branch. Frontier
  UI suite green (1264 passed); `tsc` clean; webeverything `check:standards` 0 errors.
- **Note on "no separate request."** That's a production-build property (static import → main
  bundle). The e2e runs against the Vite **dev** server, where every module is its own request, so
  the network-level claim is proven at the **codegen layer** (static `import` vs `import()`); the
  runtime/e2e proof is the sync-vs-async *application* difference.

**Deferred → own item:** per-*usage* (page-author) delivery override
[#202](/backlog/202-trait-delivery-per-usage-override/).
