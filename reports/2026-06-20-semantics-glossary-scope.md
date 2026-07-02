# Semantics glossary scope — prep research for decision #1343

**Decision:** What is the `/semantics/` glossary the ubiquitous-language vocabulary _of_? — concept
categories (intents + protocols + capabilities) vs every named standard (+ blocks + plugs). Sets (a) the
#1327 backfill volume and (b) the stream-2 coverage-gate fire-set.

## Grounding (the real tree, 2026-06-20)

- **The artifact already declares its own purpose.** `we:src/semantics.njk:10` —
  *"Ubiquitous language and precise definitions to remove ambiguity from the Web Everything
  **protocols**."* The rendered surface is a flat alpha-indexed term list; there is no per-category
  grouping in the page.
- **Term shape carries no provenance.** Each `we:src/_data/semantics/<slug>.json` is
  `{ term, definition, usage }` only (e.g. `we:src/_data/semantics/action.json`,
  `we:src/_data/semantics/ambient-intent.json`) — **no `source` / `category` / `standardRef` field**.
  So a coverage gate cannot scope its fire-set per-term; it must scope by **source registry** (enumerate
  the `intents/` + `protocols/` + `capabilities/` dirs and require a term per entry).
- **Definitions are editorial prose, not derivable.** `we:src/_data/semantics/ambient-intent.json`'s definition
  ("A designer- or product-owned *behavioral* preference … never structural — cannot set `model`…") is
  hand-authored semantic content that no `name`-field transform produces. The body's *"prefer to derive
  each term from its source JSON"* is therefore only true of the **coverage requirement** (does a term
  exist?), never the **content** (the definition stays authored).
- **The gate has a home and a precedent.** `we:scripts/check-standards.mjs:248` (§5 "Semantics glossary
  hygiene") today checks term/definition presence + duplicate terms. A coverage rule slots in beside it,
  iterating the in-scope source registries.
- **Measured gap** (audit verified against the tree): missing a glossary term per category —
  intents **46/68**, protocols **29/36**, blocks **60/80**, plugs **53/53**, capabilities **0/21**.
  Concept set (intents+protocols+capabilities) backfill ≈ **75**; every-named-standard ≈ **188**.
  Capabilities are already fully covered, so folding them into the required set costs nothing.

## Prior art

- **DDD "ubiquitous language."** The canonical output is *a glossary of domain concepts and their
  definitions* shared across roles — the language *influences* code naming (classes reflect it), but the
  glossary itself is the **concept set**, deliberately not a dump of every class/registry name. It is also
  **bounded-context-scoped** (a self-consistent vocabulary for one domain), which maps onto "scope the
  glossary to the concept layer, not the impl catalogue."
- **Design-system glossaries** (Polaris, Carbon, the design-system-glossary genre) are *terminology pages*
  for cross-functional alignment — shared vocabulary, tokens, patterns — **distinct from** the exhaustive
  component/API reference. None enumerate every component's class name as glossary terms; the component
  reference does that job.

Both traditions converge: a glossary is the **vocabulary of the concepts**, and the **catalogue** (here
`/plugs/`, `/blocks/`) is a separate surface. This is the dispositive prior art for the default.

## Finding → fork shape

- **One genuine fork:** what *categories* the glossary (and its gate) covers — concept categories vs
  every-named-standard.
- **Dissolved (pass-0), now supported-by-default:**
  - *Derive-vs-hand-author* — definitions are hand-authored; the gate enforces **presence**, not content.
    Not a fork.
  - *Gate fire-set mechanism* — **scope by source registry** (category granularity) falls out of the
    category-level line; a per-item `isConcept` flag is only needed under a curated-conceptual-block
    policy, which the default avoids. Not an independent fork.
  - *Blocks/plugs allowance* — not *required*, but *allowed*: a genuinely-conceptual block family (e.g.
    the abstract **droplist** family vs the concrete dropdown member) may carry a hand-authored term; the
    gate simply doesn't force one. Most-permissive on the author side.
  - *Capabilities* — already 0-gap; folded into the required concept set at no cost.

## Recommended default (for the decision turn)

**Concept categories — intents + protocols + capabilities** (~75% confidence). Residual: the handful of
genuinely-conceptual *block families* (abstract droplist-style) that a category-level exclusion leaves
un-required — mitigated by the "allowed, not required" allowance. The alternative (every-named-standard)
is excluded because requiring terms for 53 `Custom*` registry class names + 60 concrete impls is a
catalogue, not ubiquitous language — the body's own predicted "all-warn-noise," and against both the
DDD and design-system prior art and the glossary's own self-description.
