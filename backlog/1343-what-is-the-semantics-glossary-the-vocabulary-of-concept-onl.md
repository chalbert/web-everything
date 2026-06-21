---
kind: decision
status: open
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
preparedDate: "2026-06-20"
relatedReport: reports/2026-06-20-semantics-glossary-scope.md
researchTopic: semantics-glossary-scope
tags: [semantics, glossary, ubiquitous-language, standards-hygiene]
---

# What is the semantics glossary the vocabulary of? — concept categories vs every-named-standard

Scope fork de-buried from [#1327](/backlog/1327-semantics-glossary-comprehensiveness-audit-missing-terms-gat/)
(`/split 1327`, we:reports/2026-06-20-backlog-split-analysis.md). #1327 wants to backfill the missing
glossary terms and add a `check:standards` coverage gate — but **backfill what?** The load-bearing call
is what the `/semantics/` glossary is the *ubiquitous-language vocabulary of*, because that sets both
**(a)** the backfill volume (~75 vs ~188) and **(b)** the gate's fire-set. #1327 stays `blockedBy: 1343`
until this resolves. Prepared (research published, prior art surveyed) — ready to ratify.

## The axis

The glossary is one rendered surface — `we:src/semantics.njk:10` heads it *"Ubiquitous language and
precise definitions to remove ambiguity from the Web Everything **protocols**."* Either it is the
vocabulary of the **concept layer** (the cross-cutting semantic contracts) or of **every named
standard** (also the impl catalogue). The two cannot coexist: a single coverage gate fires on one
fire-set, and the backfill is one number. The whole call is therefore **one genuine fork** (category
scope); the body's other sub-calls dissolve on investigation (see *Supported by default*).

Grounding (real tree, 2026-06-20):
- Glossary = `we:src/_data/semantics/*.json` (203 terms), each `{ term, definition, usage }` with **no
  provenance field** (`we:src/_data/semantics/action.json`, `we:src/_data/semantics/ambient-intent.json`).
- Gate home = `we:scripts/check-standards.mjs:248` (§5 semantics-hygiene: term/definition presence +
  dup-term; a coverage rule slots in beside it).
- Source registries = `we:src/_data/{intents,blocks,protocols,plugs,capabilities}` = 68 / 80 / 36 / 53 / 21;
  **missing a term** = 46 / 60 / 29 / 53 / 0. Concept set (intents+protocols+capabilities) ≈ **75**;
  every-named-standard ≈ **188**.

## Recommended path at a glance

| Fork | Options | Recommended default | Confidence |
| --- | --- | --- | --- |
| **1 — what categories the glossary (and its gate) covers** | A concept categories (intents + protocols + capabilities) · B every named standard (+ blocks + plugs) | **A — concept categories** (gate scopes by source registry; blocks/plugs allowed but not required) | ~75% |

## Fork 1 — what categories is the glossary the vocabulary _of_?

*Fork exists:* B is a coherent end-state (a glossary that mirrors the full catalogue), and A excludes it —
they yield different gate fire-sets and backfill volumes over one shared surface, so exactly one can be
the rule. The excluded branch under the default is B: per the prior art and the page's own
self-description, requiring terms for impl/class names is a **catalogue, not ubiquitous language**.

- **A — concept categories: intents + protocols + capabilities** *(default)*. Backfill ≈ **75** (46
  intents + 29 protocols; capabilities already 0-gap, folded in at no cost). The stream-2 gate fires on
  those source registries only. Blocks + plugs are **not required** (see *Supported by default* — they
  remain *allowed* for genuinely-conceptual cases).
  - *For:* matches the artifact's declared purpose (`we:src/semantics.njk:10`, "protocols"); matches DDD
    *ubiquitous language* (a glossary of domain **concepts**, not a class dump) and design-system glossary
    practice (Polaris/Carbon terminology pages are concept surfaces, separate from the component/API
    reference); avoids the body's predicted "all-warn-noise"; aligns with #1319's codified
    `decompose-overloaded-vocabulary-by-semantic-source` instinct.
  - *Against / residual:* a few genuinely-conceptual block **families** (abstract droplist vs concrete
    dropdown) are conceptual yet a category-level exclusion leaves them un-required — mitigated by the
    "allowed, not required" allowance, and a later `isConcept` flag if the gap proves real.
- **B — every named standard (+ blocks + plugs)**. Backfill ≈ **188**. Gate fires on all five categories.
  - *For:* one uniform rule, no category judgement; "most-permissive coverage."
  - *Against:* minting a `CustomAttributeParserRegistry` glossary *term* is noise; 53 `Custom*` registry
    class names + 60 concrete impls (Button, Date Picker…) are already catalogued on `/plugs/` and
    `/blocks/`; the gate becomes all-warn-noise — the body's own predicted failure — and the glossary
    stops being *ubiquitous language*.

**Red-team note for the decision turn:** the strongest attack on A is the *most-permissive-default*
principle (when a dimension needs a default, pick the most-inclusive value). It does **not** bind here:
that principle governs **configurable axes** authors opt into, not the **editorial scope of a docs
surface** — and "most permissive" on a *signal* artifact (a glossary) is the noise failure, not the safe
default. The relevant principle is *minimize lock-in / signal-over-noise*: the glossary is the concept
vocabulary; the catalogue is `/plugs/` + `/blocks/`. Ground A on the page's own self-description before
conceding.

## Supported by default (not forks — dissolved in the prep pass)

- **Definitions are hand-authored; the gate enforces presence, not content.** The body's
  *"derive each term from its source JSON"* sub-call is not a fork: a definition is editorial prose
  (`we:src/_data/semantics/ambient-intent.json`) that no `name`-field transform produces. The "derive"
  is only the **coverage requirement** (does an in-scope standard have a term?); the content stays
  authored. So there is no derive-vs-hand-author choice to make.
- **The gate scopes by source registry, not a per-item flag.** Term JSON has no provenance field, so the
  gate iterates the in-scope dirs (`intents/` + `protocols/` + `capabilities/`) and requires a term per
  entry. A per-item `isConcept` flag is only needed under a curated-conceptual-block policy, which the
  default avoids — so this falls out of Fork 1, it is not its own fork.
- **Blocks/plugs allowed but not required.** A genuinely-conceptual abstract block *family* may carry a
  hand-authored term; the gate just doesn't force one (most-permissive on the author side, where the
  permissive default genuinely applies).
- **Capabilities folded into the required set.** Already 0-gap (21/21); including them costs nothing and
  keeps them maintained.

## On resolve

Unblocks #1327, which then `/slice`s into **(1a)** backfill the in-scope categories (presence per source
registry; definitions authored) + **(1b)/(2)** the scoped coverage gate at
`we:scripts/check-standards.mjs:248`.
