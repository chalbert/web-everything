---
type: idea
status: open
dateOpened: '2026-06-02'
tags:
  - webtraits
  - lazy-loading
  - build-time
  - code-splitting
  - behaviors
relatedReport: reports/2026-06-02-lazy-traits-loading.md
relatedProject: webtraits
---

# Build the Web Traits lazy-loading path (Map + defineLazy + Enforcer)

traits.json specs 'Scale without Weight' in 3 pillars; pillar 1 (runtime contract) has a POC (Sortable.ts), pillars 2-3 are unbuilt. Three gaps: (1) The Map — an attribute->trait-module manifest (e.g. composesTraits in blocks.json); (2) CustomAttributeRegistry.defineLazy(name, () => import()) so a behavior's code is dynamic-imported on first DOM appearance (copy the Injector's lazy register/consume dedup+cache) — the smallest first prototype; (3) The Enforcer — a Vite plugin that scans templates for trait-attributes, reads the Map, and emits split chunks + defineLazy registrations. The attribute declaration is the single source both build-time and runtime read.
