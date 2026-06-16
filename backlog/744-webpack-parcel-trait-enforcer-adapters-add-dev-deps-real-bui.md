---
type: issue
workItem: story
size: 3
parent: "715"
status: resolved
blockedBy: ["717"]
dateOpened: "2026-06-16"
dateStarted: "2026-06-16"
dateResolved: "2026-06-16"
graduatedTo: tools/trait-enforcer/webpack-plugin.ts
tags: []
---

# webpack + Parcel trait Enforcer adapters (add dev-deps + real-build verification)

Item #717 shipped the bundler-agnostic core (buildTraitManifestSource) + the Rollup and esbuild Enforcer adapters, both real-build verified. webpack and Parcel are not installed in WE, so their adapters can't be built or tested here. This item adds webpack + @parcel/core as dev-deps and writes the two remaining adapters (webpack: a virtual-module plugin over the shared core; Parcel: a Transformer/Resolver) with real-build chunk-isolation tests, completing the four-bundler baseline. The cross-tool byte-for-byte conformance remains the separate #716-gated suite.

## Resolved (2026-06-16): webpack adapter shipped; Parcel carved to #756 (surfaced a fork)

**Delivered — the webpack adapter** (`tools/trait-enforcer/webpack-plugin.ts`):
`traitEnforcerWebpack(options)` follows the shared `traitEnforcerX(options)` factory shape of the other
three adapters. webpack has no Rollup-style `resolveId`/`load`, so it intercepts the virtual id in
`normalModuleFactory.beforeResolve` and rewrites it to a `data:text/javascript` URI carrying the
`buildTraitManifestSource` output — webpack 5 parses such modules natively, so each lazy `() => import()`
still code-splits and an unused trait emits zero chunk. Verified by a **real `webpack(...)` build** added
to `__tests__/multi-bundler.test.ts` (used trait → split chunk; unused trait absent entirely). `webpack`
added as a dev-dep. Three of four installable baseline bundlers now real-build verified
(Rollup + esbuild + webpack).

**Carved out — the Parcel adapter → #756 (`type: decision`).** Starting the Parcel half surfaced a genuine
design fork the other adapters don't have: **Parcel's plugin model is declarative** (a Resolver/Transformer
referenced by name in `.parcelrc`), so the trait Map **cannot be passed as a `traitEnforcerX(options)`
factory argument** — it must arrive via a project config file or a generated `.parcelrc`. That's a public-API
fork to ratify, not mechanical work. Plus a dep-scope correction: a real Parcel build needs the full
`@parcel/config-default` stack (transformer-js, bundler-default, …), **not** just `@parcel/core` as this item
assumed — so `@parcel/core` was *not* added here; #756 adds the real stack once its fork resolves. The
"four-bundler baseline" is therefore three-real-builds + Parcel pending #756; the #716/#722 byte-for-byte
conformance suite is unaffected (it gates on whichever adapters exist).
