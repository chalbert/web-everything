---
kind: story
size: 13
status: open
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
tags: []
---

# Semantics glossary comprehensiveness — audit missing terms + gate to maintain ubiquitous language

Track all named language in `/semantics/` for one consistent vocabulary. GAP (found via #1319/#1325):
the glossary (we:src/_data/semantics/, rendered by we:src/semantics.njk) holds cross-cutting terms but
omits most named standards — Status Indicator, Notification Marker, Action, Selection, and the new Tag
intent (#1325) have `/intents/` definitions yet no glossary term, so coverage drifts. Two streams:
**(1) audit + backfill** every named intent/block/protocol/plug/capability, preferring to *derive* each
term from its source JSON (so it can't drift); **(2) harden the gate** — a `check:standards` rule
flagging any named standard with no glossary entry. Derive-vs-hand-author is decided in stream 1.

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

## Surfaced scope decision (NOT pre-resolved by the body) — blocks both streams

The body says "backfill **every** named intent/block/protocol/plug/capability." Taken literally that is
~188 entries (well past a size-8 story) **and** it conflates two different things:

- **Concept vocabulary** (intents, protocols) — genuine *semantic* terms; drift-prone; high value. This
  is the actual #1319/#1325 gap (overloaded-vocabulary decomposition needs the glossary to track the
  split). Deriving these from source JSON is coherent.
- **API class names** (the 53 `Custom*` plugs) and **concrete impls** (most of the 60 blocks: Button,
  Date Picker, …) — these are catalogued on `/plugs/` and `/blocks/`, not *ubiquitous language*. Minting
  a "Custom­AttributeParserRegistry" glossary *term* is noise, and a stream-2 gate that **fires on all
  188** would be all-warn-noise unless its fire-set is scoped to the category(ies) the glossary is for.

So the load-bearing fork is **what the semantics glossary is the vocabulary _of_** — concept-only
(intents + protocols) vs every-named-standard — and it determines (a) the backfill volume and (b) the
gate's fire-set. That is a real design call with competing end-states, not the body's stated
"derive-vs-hand-author" sub-call. Surfaced and **not** decided here.

## Reclassified (batch-2026-06-20b): size 8 → 13, released

Not batchable as one: it bundles a scope **decision** with a multi-stream **build** (backfill + gate),
and the literal scope is ~188 entries. Needs a `/decision` on the scope fork above, then a `/slice`
into (1a) backfill-the-in-scope-category and (1b)/(2) the scoped coverage gate. Audit above is the
stream-1 measurement, preserved for whoever takes the decision.
