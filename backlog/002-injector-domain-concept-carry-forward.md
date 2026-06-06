---
type: decision
status: open
dateOpened: '2026-02-24'
tags:
  - injector
  - domain
  - dsl
  - plateau-migration
  - design-decision
relatedReport: reports/2026-02-24-plateau-syntax-gap-analysis.md
relatedProject: webinjectors
---

# Decide whether to carry plateau's @domain injector concept into WE

Gap analysis of the plateau DSL found the critical missing core idea to be @domain — an abstract namespace where "the domain IS the contract" (consumers say "I need date math" without naming date-fns/dayjs/Temporal), distinct from concrete registries. The open decision: model domains as Option A (naming convention over injector set/get), Option B (first-class concept with provideToDomain/consumeFromDomain resolution), or Option C (defer until DSL build tooling exists). Sibling open threads: the provide…to / consume…of prepositions, and the <script type="injector"> declarative form (most immediately actionable, via customScriptTypes). Phased plan spec'd but unstarted.
