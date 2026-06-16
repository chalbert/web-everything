---
type: issue
workItem: story
size: 3
parent: "715"
locus: frontierui
status: resolved
blockedBy: ["716"]
dateOpened: "2026-06-15"
dateStarted: "2026-06-16"
dateResolved: "2026-06-16"
graduatedTo: none
tags: []
---

# Publish the trait tree-shaking story publicly on the Frontier UI website

Public documentation of the trait code-splitting / tree-shaking model on the Frontier UI website (FUI owns implementation docs and its own rendered display per the docs-rendering boundary). Cover: traits as the unit of code-splitting, the usage-scan → manifest → per-trait chunk pipeline, eager vs lazy vs preload delivery, the composed-component 'declare only the traits you bind' pattern, and the cross-bundler + MaaS reach. Ensures the capability is publicly discoverable, not just implemented. Blocked on the #716 contract being settled so the docs describe the neutral model, not a Vite-specific accident.

## Progress

- #716 (neutral trait-manifest contract) is resolved, so the page describes the bundler-agnostic model, not Vite specifics.
- Added `src/traits.njk` (permalink `/traits/`) on the Frontier UI website covering all five required points: traits as the code-splitting unit, the scan → manifest → per-trait-chunk pipeline, lazy/eager/lazy+preload delivery, the composed-component "declare only the traits you bind" pattern, and the cross-bundler + MaaS reach.
- Added a "Traits" nav entry in `src/_layouts/base.njk`. (locus set to frontierui — work lives on the FUI site per the docs-rendering boundary.)
- Note: #739 (fui-traits catalog) will extend `/traits/` with the per-trait catalog and reuse this Traits nav entry.
