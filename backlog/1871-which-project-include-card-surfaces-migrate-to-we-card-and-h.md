---
kind: decision
parent: "1601"
status: resolved
blockedBy: ["1886"]
dateOpened: "2026-06-27"
dateStarted: "2026-06-27"
dateResolved: "2026-06-28"
graduatedTo: none
codifiedIn: one-off
preparedDate: "2026-06-27"
relatedReport: "reports/2026-06-27-project-include-we-card-migration.md"
relatedProject: webdocs
tags: [we-card, content-card, sectioning-semantics, anchor-preservation, docs-dogfooding]
---

# Which project-* include card surfaces migrate to we-card, and how to keep section anchor/heading semantics

Blocks #1608. Once decided, #1608 becomes a clean frame swap. Research:
[/research/project-include-we-card-migration/](/research/project-include-we-card-migration/) ·
`we:reports/2026-06-27-project-include-we-card-migration.md`.

## Grounding digest

A batch pre-flight (`batch-2026-06-27-1842-1720`) found #1608's premise stale: the
`we:src/_includes/project-*.njk` includes have **no** `.project-card` catalog tiles and **no**
status-pill / dimension-chip vocabulary, so the #1820 Fork-1a badge+tag mapping (#1607 applied to the
catalog tiles) does **not** apply here. What they carry are two **content-card** surfaces:

- **`.section-card` (279)** — `<section id="…" class="section-card">` content-section wrappers with `h3`/`h4`
  children, deep-linked via `.section-card:target` + `scroll-margin-top`
  (`we:src/css/style.css:817-845,1427-1430`). The anchor `id` is on the **wrapper**
  (`we:src/_includes/project-webcomponents.njk:3,20,64`).
- **`.standard-card` (29, across 15 files — but split by tag)** — **22** are `<div class="standard-card"><h4>…`
  content cards; **7** are `<a href class="standard-card">` **link tiles** with `data-*` filter hooks
  (`we:src/_includes/project-webblocks.njk:35`, `we:src/_includes/project-webstates.njk:12`,
  `we:src/_includes/project-webplugs.njk:102`, `we:src/_includes/project-webintents.njk:50`,
  `we:src/_includes/project-webresources.njk:12`, `we:src/_includes/project-webexpressions.njk:873`,
  `we:src/_includes/project-webadapters.njk:31`) — the same catalog-tile shape #1820 governs, **not** a
  content card. The content-card anchor `id` is on the **child `<h4 id="scope-vocab">`**
  (`we:src/_includes/project-webcharts.njk:24,31,39`, `we:src/_includes/project-weblayout.njk:31,41,50`,
  `we:src/_includes/project-webrouting.njk:38,48,58`), **not** the wrapper. The
  `we:src/_includes/project-webtraits.njk:10` pillar headings are `no-toc`, no id.

`we-card` is a `TransientElement` (#1455): it resolves to `<article>` and **transfers every attribute**
except `is`/`data-transient-*`/`title`/`heading-level` onto it, then `replaceWith()`-es the host
(`fui:blocks/transient/TransientElement.ts:59-75`, `fui:blocks/card/CardElement.ts:18-49`). `title=`
generates an **id-less** `fui-card__title` heading at `heading-level` (default 3,
`fui:blocks/card/Card.ts:28,56-58`).

## Axis framing

This decision sits on two independent axes, both now grounded against the real `we-card` mechanism — which
corrects the original framing. The first axis is **scope**: which of the two surfaces is genuinely a "card."
Per MDN ([`<article>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/article) — "a self-contained
composition … independently distributable … a product card"), a `.standard-card` is a discrete
self-contained card (`<article>` is a semantic *upgrade*), whereas a `.section-card` is a page's *thematic
content section* (`<section>` is correct; re-declaring 279 of them as `<article>` downgrades the document
outline). The second axis is **anchor/heading preservation**, and here the original premise was wrong: since
`we-card` transfers attributes (`fui:blocks/transient/TransientElement.ts:62-64`), a wrapper `id` rides
through onto the `<article>` *automatically* — `.section-card:target` keeps matching if the class is kept, so
**wrapper-id survival is not a fork**. The genuine residual is the **child-heading id**: a standard-card's
`<h4 id="scope-vocab">` is an anchor target, and `we-card`'s `title=` would emit an id-less heading — so the
fork is whether to use the card's `title=` header slot or keep the explicit `<hN id>` in the body.

## Governing decision #1886 — REOPENED, re-scoped onto the substrate boundary (re-blocked)

> ⚠️ **#1886 was reopened 2026-06-27** and re-framed around the **substrate boundary** (WE contract → FUI
> primitive → product concrete component — see #1886's *REVISION*). This item is the **docs application** of
> that boundary; it is re-blocked on #1886 and re-scoped on its ratification. **Old Fork 2 (heading/title on
> the card) is dissolved** — title/heading is a *product-component* responsibility, not a `we-card` question.

This item authors the **product-composition substrate** of #1886's boundary for the WE docs site:

- **FUI primitives (consumed, not built here):** `we-card` (→`<article>`), `we-section-card` (→`<section>`)
  — transient root-bindings + base `.fui-card` style hook. No title/footer opinion.
- **Product concrete component (the actual #1871 migration):** the docs author a semantically-named
  **`standard-card`** (and a section-rooted variant) that **composes** the primitive + this site's structure
  (title, footer, items, menus) and keeps the explicit `<hN id>` heading the docs need. Namespace per the
  config knob (default empty → unprefixed `standard-card`).

**Scope (single axis now — which surface becomes which product component):**
- the 22 `<div class="standard-card">` content cards → the **`standard-card`** product component (composes
  `we-card` → `<article class="fui-card">`);
- the 279 `.section-card` `<section>` wrappers → a **section-rooted concrete card** (composes
  `we-section-card` → `<section class="fui-card">`), keeping the `<section>` landmark + wrapper `id`;
- the 7 `<a class="standard-card">` link tiles **stay `<a>`** on the #1820 catalog-tile pattern (a
  non-linkable card component can't hold a link tile).

**The ~17 anchored `<hN id>` headings ride inside the product component** (it composes the heading element
verbatim), so `#scope-vocab`-style deep-links + `:target` are preserved — *without* any heading decision at
the `we-card` layer.

**New builds this spawns:** (1) FUI primitive `we-section-card` (`CardElement`-style transient,
`resolveTag(): 'section'`); (2) the product `standard-card` component(s) in the website; (3) the namespace
config knob (default empty). Scaffolded on #1886 ratification.

**Folded in — the bespoke-style retirement (was #1895).** The product components compose the primitive's
`.fui-card` look, so today's WE-local `we:.section-card` / `we:.standard-card` frame CSS
(`we:src/css/style.css:817-845,1329-1351,1427`) retires *through* the components (bespoke classes drop to
only their non-look bits — `:target` margin, heading rules). #1895 is re-pointed/closed at ratification.

## Recommended path at a glance

| Axis | Resolution |
|---|---|
| Which product component per surface | 22 `<div>` → **`standard-card`** (composes `we-card`); 279 `<section>` → **section-rooted concrete card** (composes `we-section-card`); 7 `<a>` link tiles stay `<a>` (#1820) |
| Heading / anchor | owned by the **product component** (composes the `<hN id>` verbatim) — *no `we-card`-level fork; old Fork 2 dissolved* |
| Namespace | product owns it via config knob, default empty → unprefixed `standard-card`; `we-*` reserved for standard+primitive |

Example (revised — a `<section>` content card authored as the **product component**, composing the FUI primitive):

```njk
{# before #}
<section id="overview" class="section-card">
  <h3 id="scope-vocab">W3C selector vocabulary, wholesale</h3>
  <p>…</p>
</section>

{# after — author the PRODUCT component; it composes we-section-card and keeps the <h3 id> the docs need #}
<standard-section id="overview">
  <h3 id="scope-vocab">W3C selector vocabulary, wholesale</h3>
  <p>…</p>
</standard-section>
{# runtime DOM: <section id="overview" class="fui-card …"><h3 id="scope-vocab">…</h3><p>…</p></section> #}
{# landmark + #overview + #scope-vocab anchors preserved; bespoke .section-card frame retired #}
```

### Supported by default (not forks)

- **Wrapper `id` + `:target` survival** — preserved for free by attribute transfer
  (`fui:blocks/transient/TransientElement.ts:62-64`): keep the `id` and the `section-card`/`standard-card`
  class on `<we-card>`, both ride through onto the `<article>`. No design call.
- **Grid/layout classes** (`flex flex-col`, the standard-card grid) — transfer through unchanged.

### Build note for #1608 (not a fork — flag at implementation)

The transferred `class="standard-card"` lands on the same `<article>` as the component's own `fui-card`
class. Both declare `border` / `border-radius` / `background` (`we:src/css/style.css:1329-1351` vs
`fui:blocks/card/Card.ts:91-93`) — these are the *same* properties on one element, so it is a **last-wins
redundancy, not a literal double border**, but one rule set is then dead weight. This reconciliation —
drop the `standard-card`/`section-card` frame rules in favour of the shared `fui-card` look, keeping only
the non-look bits (`standard-card h4` heading, `.section-card:target` scroll-margin) — is the **#1895**
style-migration, not #1608's element swap. #1608 only confirms `fui-card`'s CSS is actually present on the
docs page (the transient renders into light DOM — the `CARD_CSS` must be globally injected); the look
unification rides #1895.

## Fork 1 — scope: which content-card surface converts

> ⚠️ **SUPERSEDED by the revised #1886 (see the Governing-decision section above).** The analysis below
> framed the choice as *"should the 279 `<section>`s convert to `<article>`?"* and rejected (b) on
> downgrade grounds. Under the revised composed-component model that question is **moot**: sections become a
> **`<we-section-card>` transient that erases back to `<section>`** (not `<article>`), so there is no
> downgrade — both surfaces become card *components* on their correct native roots. The historical
> `(a)/(b)/(c)` reasoning is kept below for the audit trail only.

*Fork exists because branch (b) is flawed:* `<section id>` content wrappers are sectioning landmarks
(document outline + `:target` deep-links), not self-contained compositions — erasing 279 of them to
`<article class="fui-card">` is a semantic downgrade (MDN `<article>` = self-contained/syndicatable). So
(a) and (b) genuinely cannot both be right.

- **(a) the 22 `<div class="standard-card">` content cards** *(default, amended post-skeptic)* — convert
  only the `<div>` content cards to `<we-card>`. **Exclude** (i) the 279 `.section-card` `<section>` wrappers
  (sectioning landmarks, not articles) and (ii) the **7 `<a href class="standard-card">` link tiles** — a
  link tile cannot become a `<we-card>` because `we-card` resolves to a non-linkable `<article>`
  (`fui:blocks/card/Card.ts:49`); those are catalog-tile-shaped (link + `data-*` filter hooks) and ride the
  #1820/#1607 outer-anchor pattern, not this content-card migration. The `<div>` standard-card is a discrete
  self-contained card → `<article>` is the correct element (MDN lists "product card"). Bounded size (22),
  no outline regression.
- **(b) + section-cards** — also convert the 279 `.section-card`. Rejected: downgrades 279 thematic
  page-sections to `<article>`, a far larger page-restructuring change for no semantic gain.
- **(c) neither** — dominated: a genuine card surface exists and #1608 would resolve as won't-do, defeating
  the #1601 dogfooding intent.

Example (default — standard-card, Fork 2 (b) heading kept in body):

```njk
{# before #}
<div class="standard-card">
  <h4 id="scope-vocab" class="text-lg font-bold m-0 text-gray-900">W3C selector vocabulary, wholesale</h4>
  <p class="…">…</p>
</div>

{# after — class + the child <h4 id> both ride through the transfer #}
<we-card class="standard-card">
  <h4 id="scope-vocab" class="text-lg font-bold m-0 text-gray-900">W3C selector vocabulary, wholesale</h4>
  <p class="…">…</p>
</we-card>
{# upgrades to: <article id-less wrapper, class="standard-card fui-card"> with the <h4 id="scope-vocab"> intact #}
```

Skeptic: SURVIVES-WITH-AMENDMENT — the `<section>`-stays rationale was unrefuted, but the original "convert
the 29 standard-cards" was wrong: 7 of the 29 are `<a href>` link tiles that can't become a non-linkable
`<article>` (`fui:blocks/card/Card.ts:49`). Default amended to the **22 `<div>`** content cards; the 7 link
tiles carved out to the #1820/#1607 outer-anchor pattern.

## Fork 2 — heading/anchor of the converted cards

> ⚠️ **DISSOLVED by the revised #1886 (substrate boundary).** This fork asked "where does the heading go on
> `we-card`?" — but heading/title is a **product-component** responsibility, not a primitive question. The
> product `standard-card` composes the explicit `<hN id>` heading verbatim, so the anchors are preserved with
> **no decision at the `we-card` layer**. The analysis below is kept for the audit trail only.

*Fork exists because branch (a) is flawed for anchor-bearing headings:* `we-card`'s `title=` generates an
id-less `fui-card__title`, so using it drops the `<h4 id="scope-vocab">` ids that ~17 in-page anchors target
(`we:src/_includes/project-webcharts.njk:24,31,39`, etc.). Keeping the explicit heading vs using the card
header slot genuinely cannot both hold for those headings.

- **(b) keep the explicit `<hN id>` heading inside the card body** *(default)* — do **not** lift the heading
  into `title=`. Preserves heading level and the heading's anchor `id` exactly. The card renders without a
  generated `fui-card__header`, which is fine — the existing markup already styles the heading.
- **(a) use `title=`/`heading-level=`** — idiomatic card header, but emits an id-less heading → breaks the
  ~17 live anchors. Acceptable **only** for `no-toc` headings with no id (the `we:src/_includes/project-webtraits.njk`
  pillars) — so a *hybrid* is allowed: `title=` for no-id headings, explicit-heading-in-body for anchored ones.

Example (default vs the flawed `title=` path):

```njk
{# (b) default — heading stays a child, id preserved #}
<we-card class="standard-card">
  <h4 id="scope-vocab">W3C selector vocabulary, wholesale</h4>
  …
</we-card>

{# (a) flawed for anchored headings — generated fui-card__title has NO id, #scope-vocab breaks #}
<we-card class="standard-card" title="W3C selector vocabulary, wholesale" heading-level="4">
  …  {# but #scope-vocab anchor now dangles #}
</we-card>
```

Skeptic: SURVIVES (strengthened) — `title=` not only drops the anchor id but also loses the existing
`.standard-card h4` heading styling (`we:src/css/style.css:1347`), which keeps working on the `<article>`
only because the `standard-card` class transfers. Keep-heading-in-body is both anchor- and style-coherent;
`title=` stays acceptable only for the `no-toc`, id-less webtraits pillar headings.
