---
kind: story
size: 5
parent: "1601"
status: open
dateOpened: "2026-06-30"
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

## Scope — the residual non-project-* templates

The surfaces #1608 did **not** cover: the top-level page templates that use `.section-card` / `.standard-card`
bare — `we:src/backlog-pages.njk`, `we:src/state-pages.njk`, `we:src/conformance.njk`,
`we:src/plug-pages.njk`, `we:src/demos.njk`, `we:src/demo-pages.njk`, and the ~others in that set. Migrate
each onto `standardSection` / `standardCard` (matching the convergence the project-* pages already took), or
where a full macro migration is disproportionate, minimally co-apply `.fui-card` on the surface. Watch the
inline-gradient hero cards (`we:src/demo-pages.njk`), tables, and grids where `display:flex` can reflow
children — those are the before/after-Playwright hotspots.

Then #1895 (still `blockedBy #1982`) retires the bespoke `.section-card` / `.standard-card` frame CSS, leaving
only its non-look bits (`:target` scroll-margin, heading rules).
