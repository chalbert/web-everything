---
kind: story
size: 3
status: resolved
dateOpened: "2026-06-08"
dateStarted: "2026-06-08"
dateResolved: "2026-06-08"
graduatedTo: frontierui/plugs/webbehaviors/CustomAttributeRegistry.ts
tags: [webtraits, lazy-loading, delivery, page-author, override]
relatedReport: reports/2026-06-02-lazy-traits-loading.md
relatedProject: webtraits
---

# Trait `delivery` — per-*usage* (page-author) override of the manifest default

[#200](/backlog/200-trait-delivery-default-eager-override/) shipped the trait `delivery` dimension
as a **per-trait** manifest-level setting (`delivery: eager | lazy`, default `lazy`, with an
`eager` override the trait author owns). Both #032 and #200 explicitly **deferred** a per-*usage*
override: letting a **page author** override a trait's manifest default at a specific placement,
rather than the trait author deciding globally.

**The idea:** a usage-site attribute (e.g. `<ul sortable delivery="eager">` or a reserved
`trait-delivery` modifier) that overrides the manifest default for *that element only* — e.g.
force-eager a normally-lazy trait that's above the fold on this one page, or force-lazy an
eager trait on a page where it isn't needed at first paint.

**Why it's non-trivial (the reason it was deferred):**

- **Build-time vs. runtime split.** The manifest default is resolved at build time (the Enforcer
  decides static-import vs. `import()`); a per-usage override is read at runtime from the live DOM.
  Forcing *eager* at a usage site can't retroactively bake code into the main bundle — the chunk is
  already split. So "page-author eager" likely means "prefetch/preload the chunk eagerly" rather
  than "bake into main bundle." The two delivery axes (where it's bundled vs. when it's loaded) come
  apart here and need disentangling.
- **Forcing *lazy* an eager trait** is cleaner (skip the synchronous apply, defer to first
  appearance) but interacts with the eager trait already being in the main bundle — no bundle-size
  win, only an apply-timing change. Decide whether that's even worth exposing.
- **Vocabulary + conflict-freedom.** Per the intents/traits open-design principle, the override
  syntax must be a documented part of the standard, not folklore, and must not collide with a
  trait's own value attribute (`sortable="desc"` already uses the value slot).

**Scope (when picked up):**

- Decide the semantics first (this is partly a `decision`): what "eager"/"lazy" mean at a usage site
  given the build-time split, and whether both directions are worth supporting.
- Manifest/runtime: a way for `CustomAttributeRegistry` (or `registerTraits`) to honour a per-element
  delivery hint — likely preload-on-register vs. load-on-appearance.
- Enforcer: if "page-author eager" implies preload, emit a `<link rel="modulepreload">` or eager
  prefetch for that chunk when the override appears in a scanned template.
- Spec + conformance demo: document the usage-site override on `/projects/webtraits/` and extend the
  lazy-traits fixture to show a page-author override flipping a trait's default.

Successor to the deferral noted in [#032](/backlog/032-trait-delivery-eager-vs-lazy/) and
[#200](/backlog/200-trait-delivery-default-eager-override/).

## Resolution (2026-06-08)

The per-usage delivery override shipped — **eager-only, build-time, syntax `<trait>-delivery="eager"`**.
Spec documented in webeverything; machinery + demo + e2e in Frontier UI. Full Frontier UI suite green
(1285 passed); `tsc` clean; webeverything `check:standards` 0 errors.

- **Enforcer (`frontierui we:tools/trait-enforcer/vite-plugin.ts`).** New `scanTraitDeliveryOverrides`
  finds `<trait>-delivery="eager"` usages (eager-only; `lazy`/other values ignored). The plugin
  collects a preload set and `generateManifestModule` emits a preloaded lazy trait as
  `{ delivery: "lazy", preload: true, load: () => import(spec) }` (still code-split). Preload implies
  emitted, so a trait used *only* via its override is still in the manifest.
- **Runtime manifest (`frontierui we:plugs/webbehaviors/traitManifest.ts`).** New `LazyTraitEntry`
  object form `{ delivery: 'lazy', load, preload? }`; `registerTraits` `defineLazy`s it and, when
  `preload`, calls `registry.preload(name)`. Backward-compatible — the bare `() => import()`
  shorthand is unchanged.
- **Runtime registry (`frontierui we:plugs/webbehaviors/CustomAttributeRegistry.ts`).** New
  `preload(name)` warms a pending lazy attribute's chunk immediately (reusing the existing
  `#loadLazy` dedup/cache), without waiting for first DOM appearance. No-op for unknown/eager names.
- **Spec (`webeverything we:src/_data/traits.json` + `we:project-webtraits.njk`).** New *The Per-usage
  Override — page-author preload* section: syntax, eager-only + build-time semantics, why the inverse
  is out of scope, and the `<link rel="modulepreload">` production note. The stale "deferred" line on
  *The Delivery Dimension* now points to it.
- **Conformance demo + e2e.** New lazy reference trait `frontierui fui:blocks/traits/Revealable.ts`
  (module-eval marker proves *when* the chunk loaded); `demos/lazy-traits-preload.{html,ts}` warms it
  at bootstrap from a `revealable-delivery="eager"` inside a not-yet-mounted `<template>` — the case
  only the build-time scan can see. `fui:plugs/__tests__/e2e/preload-traits.spec.ts` asserts the chunk
  evaluated before any element mounted, then applied instantly on mount. `revealable` wired into the
  Enforcer `traitMap` in `vite.config.mts`.
- **Tests.** +11 `we:trait-enforcer.test.ts` (override scan + preload codegen + plugin), +6
  `we:traitManifest.test.ts` (object-form lazy, preload-at-bootstrap, `registry.preload` dedup), +1 e2e.

**Semantics ruling (the design call this item carried):** The override is **eager-only** and a
**build-time** capability. A usage-site attribute changes only *load timing*, never *bundling*
(frozen at build) — so of the four combos only lazy→eager = "preload this chunk" has teeth; eager→lazy
is a marginal apply-defer with no bundle win and stays a fixed mechanic (dimension-vs-fixed rule). It's
fundamentally build-time: the initial DOM loads everything at bootstrap anyway (the observer keys on
DOM presence, not visibility), so the value is warming a trait whose element mounts *later* — which
only the Enforcer's template scan can see.

**Harvested (own items):** the "connected ≠ active" paradigm the discussion surfaced —
[#221](/backlog/221-behaviour-activation-gated-on-visibility/) (visibility-gated activation) and
[#222](/backlog/222-inert-dead-zone-behaviour-disable-scope/) (the native `inert` dead-zone, a
behaviour-disable scope).

## Progress

**Status:** resolved 2026-06-08.

**Branch:** docs/standard-authoring-workflow (webeverything); frontierui working tree.

**Semantics ruling (2026-06-08):** The per-usage override is **eager-only** and a **build-time**
capability. Reasoning:

- A usage-site attribute is read from the live DOM, but *where* a trait is bundled (main bundle vs.
  split chunk) is frozen at build time — so a per-usage override can only change *load timing*, not
  bundling. Of the four combos, only **lazy → eager = "preload this chunk"** has real teeth;
  eager → lazy is a marginal apply-defer with no bundle win, so it's deliberately out of scope (per
  the dimension-vs-fixed-mechanic rule: expose a fork only if both branches are legitimate
  end-states).
- The override is fundamentally **build-time**: for the *initial* DOM, every trait already loads at
  bootstrap (the MutationObserver fires on `upgrade()` for everything present, hidden or not — it
  keys on DOM presence, not visibility), so "eager" there is pointless. Its real value is warming a
  trait whose element is **not yet mounted** (a route/view not yet rendered). The runtime can't read
  an attribute off an element that isn't in the DOM — but the **Enforcer scans template source**,
  including not-yet-mounted views, so it's the thing that sees the hint.

**Syntax:** reserved per-trait suffix attribute **`<trait>-delivery="eager"`** (e.g.
`<ul sortable sortable-delivery="eager">`). Binds unambiguously to the named trait, doesn't collide
with the value slot (`sortable="desc"` still works), reuses the existing `delivery`/`eager`
vocabulary.

**Mechanism:** Enforcer scans `<trait>-delivery="eager"` → marks that lazy trait `preload: true` in
the generated manifest → `registerTraits` calls `registry.preload(name)` at bootstrap to warm the
chunk ahead of the element mounting. Build-time `<link rel="modulepreload">` is documented as the
production-earliest layer (same pattern as #200's "no separate request" — proven at the codegen
layer, runtime proof is the load-timing difference).

**Done:** semantics + syntax + mechanism decided with the user.

**Next:** (1) runtime `registry.preload` + `LazyTraitEntry`/`registerTraits` wiring; (2) Enforcer
scan + codegen; (3) unit tests; (4) `lazy-traits-preload` demo + e2e; (5) spec section in
`we:traits.json` + `we:project-webtraits.njk`.

**Notes:** harvest at close-out — a *visibility/interaction-gated lazy* capability (defer in-DOM-but-
hidden traits until visible/opened; the observer currently loads them at bootstrap regardless) is a
genuine future item, distinct from the dropped eager→lazy.

**Graduated to** `fui:frontierui/plugs/webbehaviors/CustomAttributeRegistry.ts` — per-usage <trait>-delivery=eager preload override — trait-enforcer + we:traitManifest.ts + CustomAttributeRegistry.preload + we:traits.json spec + fui:Revealable.ts demo.
