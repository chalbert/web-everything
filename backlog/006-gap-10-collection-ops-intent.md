---
kind: decision
size: 3
status: resolved
dateOpened: "2026-05-31"
dateResolved: "2026-06-11"
graduatedTo: intent:collection-operations
codifiedIn: "docs/agent/platform-decisions.md#intents-ux-only"
tags: [gap-analysis, intent, collections]
relatedReport: reports/2026-06-03-collection-operations-intent.md
---

# Decide on Collection operations intent (gap #10)

Filtering / sorting / pagination / grouping of data collections (grids, lists). `type-ahead` is focus-movement, not data ops; nothing owns this axis. No single native API — more of a vocabulary standardization play.

## Triage context

- **Kind**: Intent
- **Native grounding**: no native *operation* API — but sort's *semantics* are anchored (`aria-sort`, `Intl.Collator`, stable `Array.prototype.sort`); filter/page/group are pure vocabulary. See research page.
- **Native-first**: ◆ medium · **Gap**: ◆ medium · **Effort**: ◆ medium
- **Rank**: 10

## Open call

Confirm intent shape and the dimensions to standardize (filter/sort/page/group). Researched 2026-06-03 (see `relatedReport` / [`/research/collection-operations/`](/research/collection-operations/)).

**Decided (2026-06-03):**
- **One** Collection Operations Intent with four pipeline-stage dimensions (not a separate Sort Intent), sort carrying a structured sub-shape.
- **Everything configurable** — must describe any UX preference; the pipeline order is data, not fixed.
- **UX-only intent** — no technical references (no comparator functions, client/server flag, or registries). Comparison is a UX *preference*.
- **Front-end only** — server delegation / wire format is documented out of scope, app-owned.
- The *technical* sorting strategies now live in Plateau's Technical Configurator → **Sorting Strategy** domain.

**Still open (does not block authoring):** the complete per-dimension UX vocabulary; pipeline-order validity constraints; whether to recommend a canonical server serialization; the shared comparison primitive's home (technical layer).

## Resolution (2026-06-11)
**Resolved — the decision is settled and the intent ships.** `collection-operations` is authored in `we:intents.json` (one UX-only intent, four pipeline-stage dimensions; technical sorting lives in the Configurator's Sorting-Strategy domain). The intent-vs-project / one-intent-vs-many fork is closed per intent-UX-only. The remaining items are non-blocking refinement, not a fork: per-dimension vocabulary grows additively (intents are open-design), and "canonical server serialization" is explicitly **app-owned, out of scope for the intent** (UX-only) — so it dissolves rather than needing a ruling.
