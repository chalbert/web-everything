# project-* include content-card → `we-card` migration — scope & anchor-semantics grounding

**Date:** 2026-06-27
**Grounds:** decision [#1871](/backlog/1871-which-project-include-card-surfaces-migrate-to-we-card-and-h/) (blocks [#1608](/backlog/1608-/), parent epic #1601 — docs-surface dogfooding onto FUI blocks)
**Sibling prior art:** [#1820 / catalog-tile→we-card mapping](/research/catalog-tile-we-card-mapping/) (the *catalog-tile* fork; this is the *content-card* fork)

## Why this report exists

#1608 was filed to "migrate project-* include catalog tiles/cards to FUI blocks/card". A batch pre-flight
(`batch-2026-06-27-1842-1720`) read the actual files and found the premise stale: the
`we:src/_includes/project-*.njk` includes carry **zero** `.project-card` anchor tiles and **no**
status-pill / dimension-chip vocabulary — so the #1820 Fork-1a badge+tag mapping (#1607 applied to the
*catalog* tiles on `/intents/` `/blocks/`) does not execute here. What they actually carry are two
**content-card** surfaces, and converting those to `<we-card>` is a different migration with its own scope
and anchor-semantics call. That call is #1871; this report is its grounding.

## The two surfaces, grounded in the tree

| Surface | Count | Shape | Where the anchor `id` lives |
|---|---|---|---|
| `.section-card` | **225** | `<section id="…" class="section-card">` content-section wrapper with `h3`/`h4` children | on the **`<section>` wrapper** (`we:src/_includes/project-webcomponents.njk:3,20,64`) |
| `.standard-card` | **29** (14 files): **22 `<div>`** + **7 `<a href>`** | `<div class="standard-card"><h4>…` content cards **and** 7 `<a href class="standard-card">` link tiles | content cards: on the **child `<h4>`** (`id="scope-vocab"`); link tiles are catalog-tile-shaped (#1820) |

- Section-card deep-links: `.section-card:target` highlight + `scroll-margin-top: 100px`
  (`we:src/css/style.css:817-845,1427-1430`). TOC `#anchor` links resolve to the `<section id>`.
- Standard-card headings carrying anchor ids (sample, ~17 total):
  `we:src/_includes/project-range-anchor.njk:27,37,47` (`scope-vocab`/`scope-bundle`/`scope-strategy`),
  `we:src/_includes/project-webcharts.njk:24,31,39,183,190,197`,
  `we:src/_includes/project-weblayout.njk:31,41,50`, `we:src/_includes/project-webrouting.njk:38,48,58`.
  The `we:src/_includes/project-webtraits.njk:10` pillar headings are `no-toc` and carry **no** id.

## The `we-card` mechanism — what actually happens on upgrade

`we-card` is a `TransientElement` (#1455): on `connectedCallback` it builds the replacement, transfers
attributes, then `replaceWith()`-es itself.

- **Tag:** `resolveTag() → 'article'` (`fui:blocks/card/CardElement.ts:18-20`). The card is a semantic
  `<article class="fui-card">` (`fui:blocks/card/Card.ts:6-7,49`).
- **Attribute transfer:** *every* attribute except `is`, `data-transient-*`, and the subclass exclusions
  `title`/`heading-level` is copied verbatim onto the `<article>`
  (`fui:blocks/transient/TransientElement.ts:59-64`; exclusions at `fui:blocks/card/CardElement.ts:23-25`).
  **So `id` and `class` on `<we-card id="x" class="section-card">` ride through onto
  `<article id="x" class="section-card fui-card">`.** The host node is then removed
  (`fui:blocks/transient/TransientElement.ts:75` — `replaceWith(el)`).
- **Heading:** `title=` → a generated `h{heading-level}` with class `fui-card__title`, `heading-level`
  configurable 2–6, **default 3** (`fui:blocks/card/CardElement.ts:38-47`, `fui:blocks/card/Card.ts:28,56-58`).
  The generated heading carries **no `id`**.

### Consequence for anchors — the premise correction

The item's framing ("a we-card erases to `<article class=fui-card>`, **dropping** the `<section>` + the id
used by `#anchor` TOC links and `.section-card:target`") is **wrong on the id**: because attributes
transfer, the wrapper `id` survives on the `<article>` automatically, and if `class="section-card"` is kept
it *also* transfers — so `.section-card:target` and `.section-card h3` keep matching. The genuine residual
loss is narrower and lives in two places:

1. **The element name** `<section>` → `<article>` (a sectioning-semantics change, see below).
2. **Child-heading ids** when you use `title=`: the generated `fui-card__title` has no id, so a
   standard-card's `<h4 id="scope-vocab">` anchor breaks **unless the explicit heading is kept inside the
   body** rather than lifted into `title=`. The id is on the heading, not the wrapper, so attribute
   transfer doesn't save it.

## Web-platform grounding — `<section>` vs `<article>`

MDN/WHATWG (verified 2026-06-27, [MDN `<article>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/article)):

> "The `<article>` element represents a **self-contained composition** … intended to be **independently
> distributable or reusable** (e.g., in syndication). Examples … a magazine or newspaper article, a blog
> entry, a **product card**, a user-submitted comment, an interactive widget…"

`<section>` is, by contrast, a generic **thematic grouping of content within a larger composition**. So:

- A `.standard-card` (a discrete "pillar" / "scope plane" / "standards-status" card) **is** a self-contained
  unit — `<article>` is the *correct* element for it (MDN explicitly lists "product card"). Migrating these
  to `we-card` is a semantic upgrade, not a downgrade.
- A `.section-card` is a page's **"Mission" / "Scoped Registries" / "SSR Contract" content section** — a
  thematic part of the project page, **not** an independently distributable composition. Re-declaring 225 of
  them as `<article>` mis-states the document outline (every project page becomes a stack of "articles") and
  is a semantic downgrade. `<section id>` is the right element and should stay.

## Findings → fork shape

- **Scope is a real fork.** The 22 `<div>` standard-cards (the genuine card surface) vs also the 225 section
  wrappers. "Both" is the *flawed* branch — `<section>`→`<article>` is a sectioning downgrade — so the fork
  exists with a named-broken branch. "Neither" is dominated: a real card surface exists and the #1601 epic
  wants it dogfooded. **Skeptic amendment:** the 7 `<a href class="standard-card">` link tiles are *not*
  convertible — `we-card` resolves to a non-linkable `<article>`, so they ride the #1820/#1607 outer-anchor
  pattern, not this migration.
- **Heading/anchor preservation is a real fork.** Use `title=`/`heading-level=` (idiomatic card header) vs
  keep the explicit `<hN id>` in the body. `title=` is the flawed branch for the ~17 anchor-bearing
  standard-card headings (drops their id → breaks live in-page anchors); it is fine only for `no-toc`
  headings (the webtraits pillars).
- **Wrapper-id / `:target` is *not* a fork** — it is preserved for free by attribute transfer
  (keep `id`, keep `class`). Support-by-default.

## References

- `fui:blocks/transient/TransientElement.ts:53-87` — attribute + child transfer, deferred `replaceWith`.
- `fui:blocks/card/CardElement.ts:18-49` — `resolveTag → article`, `title`/`heading-level` mapping, exclusions.
- `fui:blocks/card/Card.ts:6-7,28,49,56-58` — article semantics, headingLevel default 3, `fui-card__title`.
- `we:src/_includes/project-*.njk` — 225 `.section-card`, 29 `.standard-card`; anchor-bearing `<h4 id>` samples above.
- `we:src/css/style.css:817-845,1329-1360,1427-1430` — `.section-card` / `.standard-card` / `:target` rules.
- [MDN `<article>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/article) — self-contained-composition semantics.
