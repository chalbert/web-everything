---
kind: story
size: 5
status: open
dateOpened: "2026-06-28"
tags: []
---

# FUI/product intent-resolution substrate — build-time custom-intent catalog assembly + resolver invocation seam

Prerequisite verified absent for #1930: FUI has ZERO references to WE's intentProfileResolver/resolveTraits/bundlePlan and no src/_data/intents glob — there is no FUI-side intent-catalog-assembly + resolver-invocation pipeline for a product manifest to feed into. #1913 placed the product-manifest glob-loader in FUI/product 'mirroring src/_data/intents', but that seam exists only in WE. Stand up the FUI/product build-time substrate (assemble the standard intent catalog + invoke the resolver) so #1930's manifest glob has a resolver to feed owner:intent customs into. Carries a likely sub-fork: does product-intent resolution live in FUI build vs plateau-app build (decision #1913 'FUI/product' is ambiguous). Investigate that placement before/within this item.
