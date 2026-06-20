---
kind: story
size: 8
parent: "715"
status: resolved
blockedBy: ["716"]
dateOpened: "2026-06-15"
dateStarted: "2026-06-16"
dateResolved: "2026-06-16"
graduatedTo: tools/trait-enforcer/rollup-plugin.ts
tags: []
---

# Baseline multi-bundler trait Enforcer: Rollup, webpack, esbuild, Parcel

Implement the trait Enforcer (usage-scan → manifest of code-split trait chunks) for the four major bundlers beyond Vite, against the #716 neutral contract. Mirrors the component-compiler precedent #234 (one card delivered Rollup/webpack/Babel wrappers for the <component> transform) — same shape, applied to traits. Each bundler integration scans templates for trait attributes and emits per-trait chunks + the virtual manifest, so an unused trait ships zero bytes regardless of toolchain. Rollup is likely cheapest (the Vite plugin's hook shape is already Rollup-compatible). Conformance that all four agree byte-for-byte is the separate #716-gated suite.

## Progress

Established the multi-bundler baseline on a shared #716-anchored core:

- **Extracted the bundler-agnostic core** — [buildTraitManifestSource](../tools/trait-enforcer/vite-plugin.ts) (scan usage → generate manifest, no bundler dep) + `DEFAULT_VIRTUAL_ID`. Refactored the Vite plugin to be thin glue over it; every adapter routes through this one function so they emit byte-identical manifests. All 30 existing trait-enforcer tests + the #719/#720 tests stay green (54 total).
- **Rollup adapter** — [we:rollup-plugin.ts](../tools/trait-enforcer/rollup-plugin.ts) (`traitEnforcerRollup`). The Vite hook shape is Rollup-native, so this is the thinnest adapter.
- **esbuild adapter** — [we:esbuild-plugin.ts](../tools/trait-enforcer/esbuild-plugin.ts) (`traitEnforcerEsbuild`), `onResolve`/`onLoad` over a virtual namespace.
- **Tests** [we:multi-bundler.test.ts](../tools/trait-enforcer/__tests__/multi-bundler.test.ts) — a **real Rollup build** and a **real esbuild build** each prove a used trait code-splits and an unused trait ships **zero bytes**, plus the core is the single source of truth. 3/3 green.

**webpack + Parcel carved to #744:** those packages aren't installed in WE, so their adapters can't be built or verified here — shipping unrunnable plugin glue would be untested-as-done. #744 adds them as dev-deps and writes the two adapters (each a thin wrapper over the same core) with real-build tests, completing the four-bundler baseline. (Byte-for-byte conformance across all four stays the separate #716-gated suite, per the card.)
