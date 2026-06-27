---
kind: decision
status: open
dateOpened: "2026-06-27"
dateStarted: "2026-06-27"
preparedDate: "2026-06-26"
relatedReport: reports/2026-06-26-catalog-tile-we-card-mapping.md
tags: [blocks, card, vocabulary-mapping]
---

# Catalog-tile to we-card vocabulary mapping (full adoption vs shallow wrap)

Prepared and ready to ratify. The recommended path is **full by-intent adoption** — the catalog tiles
become `<we-card>` frames with their status pills mapped to `<we-badge>` and their dimension/type chips
to `<we-tag>` (both already shipped), the whole-tile click-through preserved by relocating the `<a>` +
`data-*` to an outer anchor, and the non-card surfaces carved to their own rulings. This is the only
path consistent with the #1319/#1621 statute, and it is buildable in full today; the live judgment is
whether that statute-correctness is worth widening #1607/#1608 beyond a cosmetic frame swap. Grounded in
[the prep report](../reports/2026-06-26-catalog-tile-we-card-mapping.md) and
[the research topic](/research/catalog-tile-we-card-mapping/).

The decision turns on one verified-in-tree fact: each tile **is** a single `<a>` carrying `class` +
`data-status` + `data-haystack`/`data-search` + `href` on one element, and the per-page filter IIFE
queries that exact element (`we:src/intents.njk:80-86`, `we:src/blocks.njk:105-110`,
`we:src/design-systems.njk:91-93`) — it never reaches inside the badge/chip DOM. `<we-card>` resolves to
`<article>`, **not** `<a>`: it has no `href`/link affordance and `replaceWith()`-es away the original node
(`fui:blocks/card/CardElement.ts:17-51`, `excludedAttributes = ['title','heading-level']` so `data-*`/
`class`/`href` pass through to the `<article>`). So the axis is *how much of the tile's bespoke vocabulary
and click-through survives the swap* — and the #1621 precedent (resolved, codified
`we:docs/agent/platform-decisions.md#we-fui-embed-boundary`) already answered the analogous badge/chip
fork with **map-by-intent**, rejecting "bend the shared component to carry the bespoke palette" because it
re-conflated what #1319 split.

## Recommended path at a glance

| Fork | Recommended default | Main alternative | Confidence |
|------|--------------------|------------------|------------|
| Fork 1 — mapping strategy | **(a) Full by-intent adoption** (we-card frame + `<a>` relocation + status→we-badge + chips→we-tag) | (b) Shallow cosmetic wrap (frame only, vocab + JS untouched) | Med-high — statute is clear; cost to #1607/#1608 is the live tension |
| Fork 2 — non-card surfaces | **(a) Carve out** `we:src/design-systems.njk` `<div>` tiles + the `.status-meter` macro to their own by-intent rulings | (b) Fold them into this ruling | High |

## Fork 1 — tile→card mapping strategy

**Fork-existence:** a real either/or — (a) and (b) cannot coexist on the same surface (a tile is either
mapped by-intent or left as bespoke vocabulary inside a cosmetic shell), and (b) is the *flawed* branch:
it re-introduces exactly the docs-palette-on-a-shared-component conflation #1621 retired (a statute
violation, `we:docs/agent/platform-decisions.md#we-fui-embed-boundary`), not merely a cheaper option.

**Crux.** The tiles' status pill + dimension/type chips are bespoke vocabulary (`we:src/intents.njk:52`,
`:55-60`; `we:src/blocks.njk:75`, `:78-84`). #1319 split that vocabulary into owning intents — Status
Indicator (`we:src/_data/intents/status-indicator.json`) and Tag (`we:src/_data/intents/tag.json`) — and
#1621 ruled that catalog surfaces consume the intent's FUI impl, not a palette bent onto a shared
component. Both impls are **shipped and wired today** (verified): `<we-badge>` and `<we-tag>`
(`fui:blocks/tag/TagElement.ts`, `fui:embed/tag-in-document.ts`, `we:src/_layouts/base.njk:465-470` + 15
`we-tag` CSS rules in `we:src/css/style.css`). `<we-card>` itself is shipped + wired (#1786,
`we:src/_layouts/base.njk:458-462`, `we:src/css/style.css:1781-1789`).

**Options.**
- **(a) Full by-intent adoption** *(default)* — `<we-card>` provides the card frame (emitted server-side,
  upgrading in place per rule-7); the status pill maps to `<we-badge>` and dimension/type chips to
  `<we-tag>` (both now); the whole-tile click-through is preserved by **relocating** the `<a>` + the
  filter `data-*` + `.project-card` class to an *outer* anchor wrapping the `<we-card>` (since the card
  erases to a non-linkable `<article>`). Filter JS then queries the outer anchor — a mechanical, decided
  edit, not open design. Highest fidelity, statute-consistent, widest scope.
- **(b) Shallow cosmetic wrap** — `<we-card>` is only the outer frame; the bespoke badge/chip vocabulary
  and `data-*` survive inside, filter JS untouched. *Rejected* — re-introduces the #1621-retired
  conflation; the card exercises none of the intent vocabulary (low dogfood value); and it still trips
  the same anchor-vs-`<article>` relocation, so it is not even a true no-op.

**Skeptic:** REFUTED → flipped. The first-draft default ("frame + native `<a>` + status→badge now, chips
stay plain, defer to we-tag") was attacked and fell: (1) internally inconsistent — can't both keep a
native `<a>` and leave filter JS untouched, since the tile *is* the anchor and the card deletes the
original node; (2) false-premise deferral — `<we-tag>` is shipped + wired (verified in-tree), so
badge-now/chips-later is a self-inflicted #1621-style half-migration; (3) the default is now full
by-intent in one pass with the anchor relocation made explicit. The surviving live tension (folded, not
refuted): full adoption widens #1607/#1608 from a cosmetic frame swap to a uniform badge+tag pass — real
added scope, but the statute-correct scope.

## Fork 2 — the non-card surfaces

**Fork-existence:** a genuine either/or — `we:src/design-systems.njk:58-74` tiles are non-anchor `<div>`s
(no click-through) and the `we:src/_includes/project-*.njk` status uses the `.status-meter` *bar* macro
(`we:src/_includes/project-status.njk`), not a palette pill. Folding them under one "tile→card" ruling
(branch b) is the *flawed* branch: it forces three structurally-distinct surfaces through one rule and
turns the ruling into a rename.

**Options.**
- **(a) Carve out** *(default)* — `we:src/design-systems.njk`'s `<div>` tiles and the `.status-meter`
  macro get their own by-intent rulings (the `<div>` has no anchor problem; the status-meter is its own
  visual/intent question), keeping Fork 1's ruling scoped to the anchor tiles on `/intents/` + `/blocks/`.
- **(b) Single ruling for all surfaces** — *Rejected*; conflates a non-anchor div and a status-bar macro
  with the anchor-tile case, re-merging surfaces #1319 would treat distinctly.

**Skeptic:** SURVIVES — the attack ("the special-casing proves this is 3+ decisions") *is* the argument
for carving out; folded as Fork 2's default rather than a defect in Fork 1.

## Supported by default (not decisions)

- **Mount mechanism** — the rule-7 transient-CE model (register-once cross-origin import, server-side
  `<we-*>`, upgrade-in-place, SSR baseline) is already ratified (#1621) and shipped; no call here.
- **Filter-JS mechanism** — stays attribute-driven off `data-*`; Fork 1 only relocates which element
  carries them. No rework to "read off a card model" (the card model carries no such data).

## Context

- **Unblocks:** #1607 (the three core catalog pages) + #1608 (the 14 `we:src/_includes/project-*.njk`
  includes), both `blockedBy: ["1820"]`, sized 3. Fork 1 (a) keeps them mechanical (the anchor-relocation
  rule + the vocabulary map are decided here) but widens their scope to a uniform badge+tag pass.
- **Lineage:** the card counterpart to the badge/chip mapping fork #1621 (`<we-badge>`/`<we-tag>`); same
  #1319 vocabulary split; same #1786 `<we-card>` embed wiring.
