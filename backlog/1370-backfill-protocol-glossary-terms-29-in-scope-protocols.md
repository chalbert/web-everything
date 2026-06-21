---
kind: story
size: 3
parent: "1327"
status: resolved
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: src/_data/semantics/
tags: []
---

# Backfill protocol glossary terms (29 in-scope protocols)

Slice A2 of #1327 (scope ratified in #1343). Author a we:src/_data/semantics/<slug>.json term file { term, definition, usage } for each of the 29 protocols missing a glossary entry (Anchor Positioning, CustomChartRenderer, Storage, Transport Negotiation, …). Hand-authored definitions; requirement is coverage per the protocols source registry. Independent of A1/B. Partial coverage is a valid state (gate warns, doesn't err).

## Progress (batch-2026-06-20-1372-1369)

Done. Authored all **29** `we:src/_data/semantics/<slug>.json` term files (each `{ term, definition, usage }`,
hand-written definition framing the *concept* + a usage line citing the owning protocol/project). `term` is
set to the exact protocol name so the #1371 coverage normalizer matches it. The #1371 protocol-coverage
warnings dropped **29 → 0**; term count 203 → 232; gate green (`0 error(s)`, no duplicate-term errors).
Remaining glossary-coverage warnings are the sibling slices' scope (46 intents → A1 #1369, 20 capabilities
→ A3 #1380).
