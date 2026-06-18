---
type: issue
workItem: story
size: 5
parent: "715"
status: resolved
blockedBy: ["716"]
dateOpened: "2026-06-15"
dateStarted: "2026-06-16"
dateResolved: "2026-06-16"
graduatedTo: tools/trait-enforcer/composedTraitSet.ts
tags: []
---

# Composed-component trait-set authoring construct + production build-chunk assertion

A first-class authoring construct where a composed component declares the trait set it binds (so a date-picker declares calendar-grid, a time-picker declares clock — never each other's), plus a PRODUCTION build-chunk assertion that an unused trait emits zero chunk. Today only the per-usage attribute scan (#034/#202) and a Vite-dev Playwright check exist; there is no component-level trait-set declaration and no production-build (not dev-server) chunk-isolation test. This is the construct option C of #713 relies on (one abstract temporal block + named shallow preset blocks, each declaring only its traits). Blocked on the #716 contract; the cross-tool form of the assertion folds into the #716-gated conformance suite.

## Progress

- **Authoring construct** [we:composedTraitSet.ts](../tools/trait-enforcer/composedTraitSet.ts) — first-class component-level trait-set declaration over the #716 `TraitMap`:
  - `defineComposedComponent(name, traits)` — a component declares **only its own** trait set; the declared set *is* its code-split footprint (sorted `traitNames`, frozen).
  - `composeTraitSets(name, ...sets)` — a component built from sub-components binds the **union** of their declared sets (date-picker composing calendar-grid binds calendar-grid's traits, **never** clock's); a trait name declared with conflicting modules across sub-components is a hard error.
- **Production build-chunk assertion** [we:composedTraitSet.test.ts](../tools/trait-enforcer/__tests__/composedTraitSet.test.ts) — runs a **real Rollup production build** (not a dev server, not the per-usage Playwright check) over the Enforcer's generated manifest and proves: a *bound* trait emits a split chunk, an *unbound* trait emits **zero** chunk (it never appears in the manifest, so the bundler never sees its `import()`), and both ship when both are used. 7/7 vitest green; `check:standards` 0 errors.
- The cross-tool form of this assertion (webpack/Rollup/esbuild/Parcel) folds into the #716-gated conformance suite — each bundler impl (#717 baseline) runs the same production zero-chunk check.
