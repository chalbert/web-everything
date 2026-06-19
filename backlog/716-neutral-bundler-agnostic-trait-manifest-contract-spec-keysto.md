---
type: issue
workItem: story
size: 5
parent: "715"
status: resolved
dateOpened: "2026-06-15"
dateStarted: "2026-06-16"
dateResolved: "2026-06-16"
graduatedTo: tools/trait-enforcer/traitManifestContract.ts
tags: []
---

# Neutral, bundler-agnostic trait-manifest contract spec (keystone)

Extract the trait-manifest format and scan semantics into a neutral contract defined independent of any one bundler — the trait-side analogue of #505's servePathIR for MaaS. Today the 'contract' exists only as the Vite plugin's implementation (we:tools/trait-enforcer/vite-plugin.ts: generateManifestModule, scanTraitsInHtml, collectUsedTraits).

Define: the manifest entry shapes (lazy () => import() thunk, eager static import, lazy+preload hint), the attribute-scan contract (what counts as a used trait), and the chunk-isolation guarantee (unused trait → no chunk). This is the keystone every per-bundler implementation (webpack/Rollup/esbuild/Parcel/SWC) and the MaaS serve path build against, so they emit byte-identical manifests from the same input. Blocks the rest of #715.

## Progress (2026-06-15, batch-2026-06-15)

- **Authored the neutral contract** [we:tools/trait-enforcer/traitManifestContract.ts](../tools/trait-enforcer/traitManifestContract.ts)
  — the trait-side analogue of #505's `servePathIR`, holding the same neutrality rules (pure data + types,
  **no imports**, the scan grammar shipped as regex-*source* templates with a `{NAME}` substitution rule,
  never a compiled `RegExp`, so a non-TS code generator can read it). It defines the three things #715
  rests on:
  1. **Manifest entry shapes** — `LazyTraitThunk` (`() => import()`), `LazyPreloadTraitEntry`
     (`{ delivery:'lazy', preload:true, load }`), `EagerTraitEntry` (`{ delivery:'eager', attribute }`),
     unioned as `TraitManifestEntry`; plus the input `TraitMap`/`TraitMapEntry` and `DEFAULT_DELIVERY`.
  2. **Attribute-scan contract** — `USED_TRAIT_PATTERN_TEMPLATE` (what counts as a used trait — an
     attribute token, not a superstring), `DELIVERY_OVERRIDE_PATTERN_TEMPLATE` + `DELIVERY_OVERRIDE_SUFFIX`
     / `PRELOAD_OVERRIDE_VALUE` (the `<trait>-delivery="eager"` preload override, #202), `SCAN_FLAGS`,
     and the `TRAIT_NAME_ESCAPE_CHARS` escaping rule.
  3. **Chunk-isolation guarantee** — `CHUNK_ISOLATION` (unused → zero bytes; lazy is code-split; preload
     stays split; eager is the explicit baked-in opt-out) + `MANIFEST_KEY_ORDER` (key-sorted = byte-identical).
- **Made the Vite plugin the reference implementation, not the definition**
  ([we:tools/trait-enforcer/vite-plugin.ts](../tools/trait-enforcer/vite-plugin.ts)): it now imports the
  byte-determining constants + types from the contract and builds its scan `RegExp`s from the templates
  (`compilePattern`) instead of declaring its own; `TraitMap`/`TraitMapEntry` are re-exported from the
  contract (single definition), `normalizeEntry` defaults via `DEFAULT_DELIVERY`. Behaviour is byte-identical
  — the 30 existing trait-enforcer tests pass unchanged.
- **Tests** ([we:tools/trait-enforcer/__tests__/traitManifestContract.test.ts](../tools/trait-enforcer/__tests__/traitManifestContract.test.ts)):
  the contract's grammar (token vs superstring, override match), the chunk-isolation flags, and the
  equality that **the plugin's scanners == a scanner compiled straight from the contract templates** (the
  conformance every other bundler impl must also satisfy) + the key-sort determinism. 7/7 green; `tsc
  --noEmit` on the contract clean.
- **Gate:** `check:standards` shows 0 errors *from this work* — the 2 errors present are entirely in a
  concurrent session's untracked `backlog/729-*.md` (relatedProject + wiki-link), not in any file in this
  changeset; stepped over per the gate-red-scoped-to-own-work rule.
