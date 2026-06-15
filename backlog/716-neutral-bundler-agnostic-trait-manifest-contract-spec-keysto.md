---
type: issue
workItem: story
size: 5
parent: "715"
status: open
dateOpened: "2026-06-15"
tags: []
---

# Neutral, bundler-agnostic trait-manifest contract spec (keystone)

Extract the trait-manifest format and scan semantics into a neutral contract defined independent of any one bundler — the trait-side analogue of #505's servePathIR for MaaS. Today the 'contract' exists only as the Vite plugin's implementation (tools/trait-enforcer/vite-plugin.ts: generateManifestModule, scanTraitsInHtml, collectUsedTraits). Define: the manifest entry shapes (lazy () => import() thunk, eager static import, lazy+preload hint), the attribute-scan contract (what counts as a used trait), and the chunk-isolation guarantee (unused trait → no chunk). This is the keystone every per-bundler implementation (webpack/Rollup/esbuild/Parcel/SWC) and the MaaS serve path build against, so they emit byte-identical manifests from the same input. Blocks the rest of #715.
