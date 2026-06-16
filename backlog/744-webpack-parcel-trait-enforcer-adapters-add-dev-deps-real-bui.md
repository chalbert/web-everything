---
type: issue
workItem: story
size: 3
parent: "715"
status: open
blockedBy: ["717"]
dateOpened: "2026-06-16"
tags: []
---

# webpack + Parcel trait Enforcer adapters (add dev-deps + real-build verification)

Item #717 shipped the bundler-agnostic core (buildTraitManifestSource) + the Rollup and esbuild Enforcer adapters, both real-build verified. webpack and Parcel are not installed in WE, so their adapters can't be built or tested here. This item adds webpack + @parcel/core as dev-deps and writes the two remaining adapters (webpack: a virtual-module plugin over the shared core; Parcel: a Transformer/Resolver) with real-build chunk-isolation tests, completing the four-bundler baseline. The cross-tool byte-for-byte conformance remains the separate #716-gated suite.
