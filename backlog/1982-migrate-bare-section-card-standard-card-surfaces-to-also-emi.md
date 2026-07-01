---
kind: story
size: 13
parent: "1601"
status: resolved
dateOpened: "2026-06-30"
dateStarted: "2026-07-01"
dateResolved: "2026-07-01"
graduatedTo: none
tags: [card, fui-card, product-component, dead-css]
---

# Migrate the remaining bare .section-card / .standard-card surfaces onto the shipped product-card components (unblocks #1895)

Migrate the non-project-* templates that still use `.section-card` / `.standard-card` **bare** (no
`.fui-card`) onto the shipped product-card components, so #1895 can retire the bespoke frame in
`we:src/css/style.css` without a visual regression. Verify with before/after Playwright on the running dev
server.

## Current state (updated batch-2026-07-01 — the fork is closed, mechanism shipped)

The design fork this item once carried is **resolved and the machinery has shipped** — this is now a clean
mechanical migration, not a decision:

- **Path ratified.** #1886 (three-substrate boundary) + #1871 (which surface → which product component) both
  resolved; the answer is composed product components, not a hand-applied class.
- **Primitives shipped.** FUI `we-card` → `<article>` (#1786) and `we-section-card` → `<section>` (#1903).
- **Product components shipped.** `we:src/_includes/product-components.njk` (#1953) exposes the
  `standardSection` / `standardCard` macros, which emit `class="section-card fui-card"` /
  `class="standard-card fui-card"` (co-applying `.fui-card` on the FUI base-style hook) while keeping the
  wrapper `id` + each `<hN id>` heading verbatim for `:target` deep-links.
- **The project-* includes are DONE.** Epic #1608's seven bucket slices (#1953–1959) migrated every
  `we:src/_includes/project-*.njk` surface onto those macros — so the `.fui-card` visual convergence
  (`border-radius` 16px→8px, `display` block→flex-column) is already the **shipped, accepted** look on those
  pages. This item inherits that ratified convergence; it is not re-litigating it.

## Scope — the TRUE residual (re-grounded batch-2026-07-01-1930-1982, resized 5 → 13, OUTGREW)

A pre-resolve survey found the residual is **far larger and more heterogeneous** than the "~14 non-project-*
page templates" this item and its earlier rewrite assumed. A precise grep (`class` attrs containing
`section-card` but NOT `fui-card`, all `.njk`) finds **~113 bare occurrences across ~28 files**, in three
distinct sub-cases — so this is a `story·13` (bumped out of the batch pool), best **split** (`/split`)
before building. **`.standard-card` in the page templates is NOT in scope** — all its occurrences are
`<a class="standard-card">` **link tiles**, which #1871 ruled stay bare `<a>` on the #1820 catalog-tile
pattern (a link tile is not a card); #1608 likewise left the project-* link tiles bare. So the migration is
purely the `.section-card` **content** surfaces.

**Sub-case A — page-template `<section class="section-card">` content cards (~55, ~13 files):**
`we:src/block-pages.njk` (14), `we:src/intent-pages.njk` (6), `we:src/research-topic-pages.njk` (5),
`we:src/demo-pages.njk` (5), `we:src/capability-pages.njk` (4), `we:src/backlog-pages.njk` (4),
`we:src/capability-adapter-pages.njk` (3), `we:src/conformance.njk` (2), and one each in
`we:src/state-pages.njk`, `we:src/semantics.njk` (the `p-0 overflow-hidden` full-bleed hotspot),
`we:src/resource-pages.njk`, `we:src/plug-pages.njk`, `we:src/demos.njk`, `we:src/adapter-pages.njk`.
Clean co-apply of `.fui-card` (matching the shipped project-* convergence, `border-radius` 16px→8px,
`display` block→flex-column).

**Sub-case B — content-include partials (~60, ~7 files) never in #1608's project-* scope:**
`we:src/_includes/adapter-descriptions/*.njk` (jsx 12, template-string 11, html 11, declarative-component 5,
functional-component 4, mousetrap 3, floating-ui 3 — all `<section class="section-card"><h3 id>` content
cards rendered on adapter pages), `we:src/_includes/block-descriptions/component.njk` (9),
`we:src/_includes/research-descriptions/project-include-we-card-migration.njk` (2). Same co-apply, but each
partial reflows inside a host page (code samples / grids) → each is a before/after-Playwright surface.

**Sub-case C — `<details class="section-card">` disclosure-cards (4+):** the 4 "stray" project-* bare
section-cards (`we:src/_includes/project-webtraces.njk:7`, `we:src/_includes/project-webresources.njk:134`,
`we:src/_includes/project-webcontexts.njk:269`, `we:src/_includes/project-webportals.njk:900`) are
`<details ... style="margin-top:2rem">` disclosure widgets — a DIFFERENT element the `standardSection` macro
(→`<section>`) cannot host, which is why #1608 correctly left them. Co-applying `.fui-card` to a `<details>`
is a distinct sub-case (does the flex-column card look hold on a disclosure widget?) — a small surface-shape
judgment, not a blind add.

**Why it stopped (batch stop-rule 4, outgrew):** claimed and begun, then the true residual sprawled to
~2.5× the scoped occurrences across file sets + element hosts not in the size·5, and a **partial** migration
can't unblock #1895 (any remaining bare `.section-card` regresses the moment the frame is deleted), so
"do the part that fits" is not available. Recommend `/split` into per-sub-case slices (A page templates /
B include partials / C `<details>` disclosure) — each independently before/after-verifiable — then batch
the slices. The mechanical transform is proven safe: `class="section-card` → `class="section-card fui-card`
(precise; catches all `.section-card` starts, never the `<a>` link tiles), verified with a live
`:3000` before-capture showing the 16px/block → 8px/flex flip is the intended, already-shipped convergence.

Then #1895 (still `blockedBy #1982`) retires the bespoke `.section-card` / `.standard-card` frame CSS, leaving
only its non-look bits (`:target` scroll-margin, heading rules).

## Done (session 2026-07-01 — migrated in place as ONE uniform co-apply, not split)

Executed the whole residual in a single pass rather than `/split`-ing: the transform is uniform across all
three sub-cases (add `fui-card` as the second class on the existing tag — element type is irrelevant to a
co-apply), and a **partial** migration can't unblock #1895, so splitting into A/B/C slices that all must land
anyway added ceremony without reducing risk. The two genuine judgment spots were verified individually.

**What actually shipped** (anchored transform `<(section|div|details) class="section-card"` → `… fui-card …`,
negative-lookahead so it never double-applies; anchored on the real opening tag so escaped `&lt;section` /
`<code>` doc-samples are naturally skipped):

- **26 templates touched**, **111 real occurrences** co-applied. Grounding corrected two scope errors in the
  survey above: (a) sub-case A page-template cards are `<div class="section-card">` (49), **not** `<section>`
  as written — irrelevant to the co-apply but noted; the section-card content cards are 58 `<section>` (mostly
  the adapter/block-description partials) + 4 `<details>`. (b) The 2
  `we:src/_includes/research-descriptions/project-include-we-card-migration.njk` "sub-case B" occurrences are
  **documentation** (escaped `&lt;section … class="section-card"&gt;` inside `<code>`), never real cards —
  correctly excluded. `.standard-card` link tiles stayed bare (`<a>` tiles, per #1871), as scoped.
- **Verified before/after on the running `:3000` dev server**, one surface per case: `/blocks/action-button/`
  (A, `<div>` cards), `/adapters/html-adapter/` (B, `<section>` cards + code-sample reflow),
  `/projects/webtraces/` (C, `<details>` disclosure), `/semantics/` (the `p-0 overflow-hidden` full-bleed
  hotspot). All show the accepted project-* convergence (radius 16px→8px, block→flex-column) with **no
  regression**: the `<details>` collapsed card is pixel-identical; the `p-0` full-bleed list keeps its
  edge-to-edge rows (`.p-0 { padding:0 !important }` overrides the fui-card padding, flex-column just stacks
  the already-full-width rows as block flow did).
- **0 real bare `.section-card` elements remain** (only the two escaped doc-samples, unaffected by CSS
  deletion). `check:standards` green for all touched templates (the 1 pre-existing gate error is in #1733, a
  code-path locus, untouched here). **#1895 is unblocked.**
