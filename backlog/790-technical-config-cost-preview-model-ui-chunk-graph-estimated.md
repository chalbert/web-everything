---
type: idea
workItem: story
size: 5
parent: "746"
status: resolved
blockedBy: ["789"]
locus: plateau-app
relatedProject: webdocs
dateOpened: "2026-06-16"
dateStarted: "2026-06-16"
dateResolved: "2026-06-16"
graduatedTo: "plateau-app: src/technical-configurator/cost-preview.ts"
tags: [webdocs, technical-configurator, plateau-embed, cost-preview, chunks]
---

# Technical-config cost-preview model + UI — chunk graph + estimated bytes/requests/hydration for the selected config

Build a cost-preview for a chosen technical config: render the resulting chunk graph + an estimated bytes / requests / hydration cost. v1 fidelity = a rough estimate derived from the chunk-split domain data (#719/#720, resolved) — POC pragmatism, refine later. Makes the technical tradeoff concrete rather than abstract. Consumed by the embedded per-block configurator (#752); blocked on the chunk-split Configurator domain (#789).

## Progress (resolved 2026-06-16) — locus: plateau-app
- New `src/technical-configurator/cost-preview.ts`: pure cost model `estimateChunkCost(traits, capabilities)` deriving the **chunk graph** + **bytes / requests / hydration** from the #789 chunk-split capabilities (`granularity` → one chunk vs one-per-trait; `unused-elimination` tree-shaken → only used traits ship; each chunk = one request; hydration ≈ shipped-bytes/2KB + per-chunk parse). v1 is deliberately order-of-magnitude (POC, #719/#720). `strategyCost(traits, id)` looks up a named strategy's capabilities from `chunkSplitDomain`.
- `mountCostPreview()` renders a card per chunk-split strategy (bundler-split / MaaS-served / monolithic) with its metrics + chunk graph over a sample trait set; CSS + wired onto the `/technical-configurator` route. The per-block trait set arrives later from the embedded configurator (#752) / the WE resolver (#776).
- Tests: `cost-preview.test.ts` (6/6) pin the graph shape per capability combo, that tree-shaken ships fewer bytes, and the named-strategy lookup (incl. unknown-id no-throw). Full plateau-app suite green (25 files, 195 tests). Browser-verified on `:4000/technical-configurator`: 3 strategy cards (e.g. "3.9 KB shipped · 3 requests · ~5 ms hydration").
