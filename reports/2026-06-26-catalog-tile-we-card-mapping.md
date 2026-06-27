# Catalog-tile → `we-card` vocabulary mapping — decision-prep grounding (#1820)

**Date:** 2026-06-26 · **Grounds:** decision [#1820] · **Unblocks:** #1607, #1608 · **Precedent:** #1621 / #1319 / #1786

## What this decision is

The catalog "tiles" — the clickable cards on `/intents/`, `/blocks/`, `/design-systems/`, and the
14 `project-*.njk` includes — carry a bespoke per-status palette badge + dimension/type chips, all
hung off `data-*` attributes a per-page filter IIFE reads. None of that maps onto FUI's `<we-card>`
(a `TransientElement` that erases to `<article class="fui-card">`) without a design call. #1607 and
#1608 were re-pointed `blockedBy: ["1820"]` to make this the single ruling that converts them from
design work into mechanical migrations.

## Grounding (real tree)

### The tiles are anchors; the data model is on the anchor

- `we:src/intents.njk:45-62` — `<a class="project-card intent-tile" data-status data-haystack>`;
  inline per-status palette badge at `:52`; dimension chips (`<span>` pills) at `:55-60`.
- `we:src/blocks.njk:67-86` — `<a class="project-card block-card" data-type data-status data-search>`;
  palette badge `:75`; a `type` chip + an `Intent:` chip `:78-84`.
- `we:src/design-systems.njk:58-74` — a **`<div class="project-card">`** (NOT an anchor — not
  clickable), `data-project data-status`; badge `:64`; project chip + `<code>` manifest chip `:67-73`.
- `we:src/_includes/project-*.njk` (14 files), e.g. `we:src/_includes/project-webblocks.njk:35-46` —
  `<a class="standard-card" data-type data-name data-summary>`; status via the
  `projectStatus()` macro → `we:src/_includes/project-status.njk` emits a **`.status-meter` bar**, a
  different status visual entirely (not a palette pill).

The load-bearing fact: `class`, `data-status`, `data-haystack`/`data-search`, and the click-through
`href` all live on the **same `<a>`**. The filter JS queries that element directly —
`we:src/intents.njk:80-86` reads `tile.dataset.status`/`.haystack` and toggles `tile.style.display`;
`we:src/blocks.njk:105-110` and `we:src/design-systems.njk:91-93` mirror it. The filter never reaches
inside the badge/chip DOM.

### `<we-card>` erases to `<article>` and deletes the original node

- `fui:blocks/card/CardElement.ts:17-51` — `<we-card title heading-level>` upgrades and
  **replaces itself** (`TransientElement.connectedCallback` → `this.replaceWith(article)`); children
  become `.fui-card__body`. `excludedAttributes` = `['title','heading-level']` (`:24`), so all other
  attributes (`data-*`, `class`, `href`) pass through to the `<article>`.
- It resolves to `<article>`, **not `<a>`** — no `href`, no link affordance. The factory
  (`fui:blocks/card/Card.ts:18-31`) adds footer/actions, but the declarative element exposes only
  `title` + body.
- Already shipped + wired (#1786): `we:src/_layouts/base.njk:458-462` cross-origin import +
  `we:src/css/style.css:1781-1789` `we-card{}` SSR baseline. **The infra blocker is gone; #1820 is the
  only thing holding #1607/#1608.**

### The #1621 precedent — map-by-intent, not bend-the-component

`we:backlog/1621-*.md` (resolved, codified at `we:docs/agent/platform-decisions.md#we-fui-embed-boundary`)
resolved the **analogous** badge/chip fork. It rejected "bend the shared component to carry the bespoke
docs palette" because that re-conflated what **#1319** deliberately split (Status Indicator vs Tag vs
Notification Marker). The ruling: **map each surface to its owning intent, then consume that intent's
FUI impl** — lifecycle states → `<we-badge>` (Status Indicator,
`we:src/_data/intents/status-indicator.json`), categorical labels → `<we-tag>` (Tag,
`we:src/_data/intents/tag.json`). Mount via the **rule-7 transient-CE model**: register once via
cross-origin import, emit `<we-*>` server-side, upgrade in place, ship a `we-*{}` SSR baseline to kill
the flash (`we:docs/agent/platform-decisions.md:195-210`).

### `<we-tag>` is already shipped (verified — it is NOT blocked)

`fui:blocks/tag/TagElement.ts` + `fui:embed/tag-in-document.ts` exist; `<we-tag>` is wired in
`we:src/_layouts/base.njk:465-470` and carries 15 categorical-vocabulary rules in `we:src/css/style.css`.
So **both** the badge and tag impls the by-intent mapping needs are available **today** — the "defer
chips until we-tag lands" framing is a false premise.

## Skeptic pass (refute-only sub-agent) — verdict: REFUTED, default reshaped

The first-draft default ("we-card frame + native `<a>` + status→badge now, chips stay plain spans,
defer to we-tag") was attacked and fell on three grounds, all verified:

1. **Internally inconsistent.** Because the tile *is* the anchor and `we-card` `replaceWith`-es to an
   `<article>`, you cannot both "keep a native `<a>`" *and* leave the filter JS untouched — wrapping
   the card in an `<a>` forces `.project-card`/`data-*` to move onto the new outer anchor (the very
   element the filter queries). The anchor-vs-frame relationship is unresolved design, not a no-op.
2. **False-premise deferral.** "Chips stay plain because we-tag isn't ready" is wrong — `<we-tag>` is
   shipped and wired (verified above). Badge-now/chips-later is a self-inflicted #1621-style
   half-migration (some vocab mapped, some not, on the same surface).
3. **Three surfaces, not one.** Anchor tiles / a `<div>` / the `.status-meter` macro have nothing
   structurally in common; folding them under one ruling makes the "decision" a rename.

Folded result: the prepared default is now **full by-intent mapping in one pass** (status→`we-badge`,
categorical/dimension/type chips→`we-tag`, both shipped), with the anchor-vs-frame question resolved
explicitly (`<a>` wraps `<we-card>`, `.project-card`/`data-*` relocated to the outer anchor), and the
non-card surfaces (`we:src/design-systems.njk` `<div>`, the `.status-meter` macro) carved to their own
by-intent rulings rather than `we-card` special-cases.

## #1607 / #1608

Both `blockedBy: ["1820"]`, sized 3, re-pointed precisely to become mechanical. #1607 = the three core
catalog pages; #1608 = the 14 `project-*.njk` includes. The corrected default keeps them mechanical by
deciding the anchor-relocation rule + the by-intent vocabulary map up front — but note it widens their
scope to a uniform by-intent pass (badge + tag) rather than a cosmetic frame swap.
