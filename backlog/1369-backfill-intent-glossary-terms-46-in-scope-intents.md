---
kind: story
size: 5
parent: "1327"
status: resolved
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: src/_data/semantics/
tags: []
---

# Backfill intent glossary terms (46 in-scope intents)

Slice A1 of #1327 (scope ratified in #1343). Author a we:src/_data/semantics/<slug>.json term file { term, definition, usage } for each of the 46 intents missing a glossary entry (Status Indicator, Notification Marker, Selection, Tag, Hierarchy, Icon, Density, Locale, Temporal, Sectioning, …). Definitions are hand-authored editorial prose (no transform derives them — #1343 Supported-by-default); the requirement is coverage (every in-scope intent has a term). Independent of A2/B (different source registry). Leaves a valid state: partial coverage clears the gate's warn-level misses incrementally.

## Progress (batch-2026-06-20-1372-1369)

Done. Authored all **46** `we:src/_data/semantics/<slug>.json` term files (each `{ term, definition, usage }`,
hand-written editorial prose framing the *concept* + a usage line citing the owning intent/project). `term`
set to the exact intent name so the #1371 coverage normalizer matches. The #1371 intent-coverage warnings
dropped **46 → 0**; term count 232 → 278; gate green (`0 error(s)`, no duplicate-term errors). Only the 20
capability-coverage warnings remain — that residual is tracked by A3 (#1380, the #1343 mis-estimate).
