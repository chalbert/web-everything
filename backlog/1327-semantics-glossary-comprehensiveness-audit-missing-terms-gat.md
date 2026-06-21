---
kind: epic
status: resolved
relatedReport: reports/2026-06-21-backlog-split-analysis.md
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-21"
graduatedTo: none
tags: []
---

# Semantics glossary comprehensiveness — audit missing terms + gate to maintain ubiquitous language

**Umbrella** — bring the `/semantics/` glossary up to the #1343-ratified scope (the concept categories
required wholesale + `isConcept` opt-in for contested-name blocks/plugs) and keep it there with a gate.
GAP (found via #1319/#1325): the glossary (we:src/_data/semantics/, rendered by we:src/semantics.njk)
omits ~75 in-scope concept terms — Status Indicator, Notification Marker, Selection, the new Tag intent
(#1325), … have `/intents/` definitions yet no glossary term, so coverage drifts. Sliced 2026-06-21
(we:reports/2026-06-21-backlog-split-analysis.md) into: **A1** backfill intent terms (46) · **A2**
backfill protocol terms (29) · **B** the scoped coverage gate (+ `isConcept` honoring) · **C** the
block/plug curation pass (#1368). The audit table + resolved scope below are preserved as the slices'
shared grounding.

## Audit (batch-2026-06-20b, stream-1 measurement) — gap is ~188 entries across 5 categories

Ran an inline term-coverage join (`semantics/*.json` `term` vs each standard's `name`, normalized by
stripping the `Intent`/`Protocol`/`Plug`/`Capability`/`Block` suffix). Gap per category:

| Category | Total | Missing a glossary term |
| --- | --- | --- |
| intents | 68 | **46** (Status Indicator, Notification Marker, Selection, Tag, Hierarchy, Icon, Density, Locale, Temporal, … incl. the new Sectioning) |
| blocks | 80 | **60** (Button, Checkbox, Dialog, Data Grid, Date Picker, parsers, …) |
| protocols | 36 | **29** (Anchor Positioning, CustomChartRenderer, Storage, Transport Negotiation, …) |
| plugs | 53 | **53** (every `Custom*` registry/class + the native-patch plugs) |
| capabilities | 21 | 0 (fully covered) |

(`Action` already HAS a term — the body's example was stale; the real intent gap is the other 46.)

## Surfaced scope decision → carved to [#1343](/backlog/1343-what-is-the-semantics-glossary-the-vocabulary-of-concept-onl/)

The load-bearing fork — **what the semantics glossary is the vocabulary _of_** (concept-only
{intents + protocols} vs every-named-standard) — sets both the backfill volume (~75 vs ~188) and the
stream-2 gate's fire-set. It is a real design call with competing end-states, **not** the "derive-vs-
hand-author" sub-call. De-buried into its own decision card **#1343** (`/split 1327`,
we:reports/2026-06-20-backlog-split-analysis.md); this story is `blockedBy: 1343` and cannot be sliced
until it resolves.

## Scope resolved 2026-06-21 — #1343 ratified A + `isConcept` opt-in

**Unblocked.** [#1343](/backlog/1343-what-is-the-semantics-glossary-the-vocabulary-of-concept-onl/)
ruled: glossary = ubiquitous-language vocabulary of the **concept categories** (intents + protocols +
capabilities), required **wholesale** by source registry (~75) — **plus** any block/plug flagged
`isConcept: true` (a load-bearing naming choice WE disambiguated, e.g. `tag`). B (every named standard,
~188) rejected. So the audit table above is the *measurement*, but the **fire-set is ~75 wholesale +
opt-in blocks/plugs**, not 188. `/slice` this into:
- **(1a)** backfill the in-scope categories (intents + protocols; capabilities 0-gap) — terms authored,
  presence enforced per source registry.
- **(1b)/(2)** the scoped coverage gate at `we:scripts/check-standards.mjs:248` — wholesale for the
  concept categories + per-item for `isConcept: true` blocks/plugs.
- **(1c)** the block/plug curation pass to surface + flag `isConcept` names → carved to **#1368**
  (`blockedBy: 1327`).

## Reclassified (batch-2026-06-20b): size 8 → 13, released

Not batchable as one: it bundles a scope **decision** with a multi-stream **build** (backfill + gate),
and the literal scope is ~188 entries. Needs a `/decision` on the scope fork above, then a `/slice`
into (1a) backfill-the-in-scope-category and (1b)/(2) the scoped coverage gate. Audit above is the
stream-1 measurement, preserved for whoever takes the decision.
