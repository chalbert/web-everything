# WE-docs hand-written UI inventory → FUI component map (#778, feeds epic #777)

**Date:** 2026-06-16 · **Item:** [#778](/backlog/778-inventory-we-docs-hand-written-ui-and-map-each-surface-to-it/) · **Epic:** [#777](/backlog/777/) (dogfood WE-docs chrome on FUI components) · **Consumes-from:** [#658](/backlog/658/) (the FUI-must-build column)

Pure audit — no code, no boundary dependency, so it runs **ahead of** the [#765](/backlog/765/) relaxation gate (which every actual migration slice is blocked on). It enumerates every hand-written chrome + page-level surface in WE-docs and maps each to the FUI block that would replace it, flagging which FUI must still build.

## Method

Surveyed `src/_layouts/base.njk` (header/nav/footer/shell + inline scripts), `src/css/style.css` (1711 lines — the component class families), `src/assets/js/reveal-nav.js`, the `src/*.njk` catalog/index pages, and `src/_includes/**` partials. Mapped against the FUI block catalog (`frontierui/src/_data/blocks.json`, 24 blocks): `simple-store, view, tabs, router, handler-expression-parser, event-behaviors, transient-component, audit-trail, background-task-surface, data-grid, droplist, for-each, lifecycle, master-detail, nav-list, resource-loader, selection, stepper, tree-select, type-ahead` + 3 parsers.

## Chrome surfaces (the page frame — base.njk)

| # | Surface | Source | FUI component | Status |
|---|---------|--------|---------------|--------|
| C1 | App shell / sticky header bar | `base.njk:19-96` `.site-header` `.header-controls` | *(layout primitive — app-shell/header)* | **FUI gap** — no shell/header-layout block |
| C2 | Brand lockup (logo + title) | `base.njk:21-24` `.site-title` | *(plain anchor+img; theme-tokened)* | No block needed (theme only) |
| C3 | Tagline | `base.njk:25` `.site-tagline` | *(text; theme-tokened)* | No block needed |
| C4 | Disclosure nav — link lists | `base.njk:32-88` `.nav-menu` `.nav-group-links` (the #645 APG disclosure) | **`nav-list`** (the #645 conform-to ref) | FUI exists — covers the link lists |
| C5 | Nav section heads (expand/collapse panels) | `base.njk:43/60/75` `.nav-menu-head` `aria-expanded` | *(disclosure button + panel)* | **FUI gap** — no `disclosure` block; nav-list is flat, not sectioned |
| C6 | Mobile nav toggle (hamburger) | `base.njk:28-31` `.nav-toggle` + inline script `:112-146` | *(disclosure/icon button)* | **FUI gap** — no `button`/`disclosure` block |
| C7 | Header icon buttons (GitHub, Spec Explorer) | `base.njk:89-94` `.header-icon` | *(icon button)* | **FUI gap** — no `button` block |
| C8 | Footer | `base.njk:102-109` `.site-footer` | *(layout; theme-tokened)* | No block needed |
| C9 | Disclosure-nav behavior (click/Esc/outside-click) | `reveal-nav.js` + `base.njk:112-146` | **`nav-list`** + **`event-behaviors`** | FUI exists — behavior ships with nav-list |
| C10 | Spec Explorer side panel (resizable iframe) | `base.njk:148-399` `.claude-panel` | *(dev-only tool)* | **Excluded** — dev tooling, not dogfood chrome |

## Page-level surfaces (catalog/index pages + includes + CSS)

| # | Surface | Source | FUI component | Status |
|---|---------|--------|---------------|--------|
| P1 | Catalog tiles / cards | `.standard-card`, `.content-box`, project/intent/block tiles (`*.njk` indexes) | *(card)* | **FUI gap** — no `card` block |
| P2 | Sortable backlog + prioritisation tables | `backlog.njk`, `backlog-table-sort.js` | **`data-grid`** (sortable) | FUI exists |
| P3 | Display toolbar (search + filter chips + list/grid view) | `display-toolbar.njk`, `.home-display-toolbar` `.home-search` `.home-filter` `.backlog-filter-row` | **`type-ahead`** (search) + *(filter-chip group)* | Partial — type-ahead exists; **gap**: filter-chip/segmented control |
| P4 | Status / type / baseline badges | `.bg-*`/`.border-*` badge utility clusters across indexes | *(badge / tag)* | **FUI gap** — no `badge` block |
| P5 | Buttons (back, actions, links-as-buttons) | `.btn-back`, `.action-area`, `.creator-link` | *(button)* | **FUI gap** — no `button` block |
| P6 | Code sample frame + copy | `.code-block-dark`, prism-theme.css, `copy-code.js`, `component-source-toggle.njk` | *(code-block / syntax view)* | **FUI gap** — no `code-block` block |
| P7 | Mode / format / source / strategy toggles | `mode-selector.njk`, `format-selector.njk`, `source-toggle.njk`, `strategy-toggle.njk` | **`tabs`** / **`selection`** / **`droplist`** | FUI exists — map per toggle semantics |
| P8 | Burndown / coverage meters | `.meter-track` `.meter-fill` | *(meter / progress)* | **FUI gap** — no `meter` block |
| P9 | Project-page layout (sidebar TOC + body) | `project-pages.njk` `.project-layout` `.project-sidebar` + tocbot | **`master-detail`** + *(TOC nav)* | Partial — master-detail exists; **gap**: `toc` nav |
| P10 | FUI demo embed | `.fui-demo` iframe (`fuiDemo` shortcode, #701) | *(already the FUI-hosted demo iframe)* | Not chrome — embed mechanism, no migration |

## Summary — FUI coverage

- **FUI components that already cover a surface (8):** `nav-list` (C4/C9), `event-behaviors` (C9), `data-grid` (P2), `type-ahead` (P3), `tabs`/`selection`/`droplist` (P7), `master-detail` (P9).
- **FUI must build (8 gaps, feed [#658](/backlog/658/)):** `button` (C6/C7/P5), `disclosure` / sectioned nav panel (C5), app-shell/header layout primitive (C1), `card` (P1), filter-chip / segmented control (P3), `badge` (P4), `code-block` / syntax-highlight (P6), `meter` / progress (P8), `toc` nav (P9).
- **Theme-only (no block — needs the [#747](/backlog/747/) theme+intents bundle for WE-docs branding):** C2, C3, C8.
- **Excluded:** C10 Spec Explorer side panel (dev-only tooling, not part of the dogfooded front door).

## Notes for the migration slices (epic #777)

- Every migration slice is **hard-gated on [#765](/backlog/765/)** (the in-document Shadow-DOM DI mount, mode C); this audit is the only #777 slice that runs before it.
- The 8 must-build FUI blocks are the critical path: WE-docs chrome cannot mount what FUI doesn't ship. File/track them under #658 (promote `@frontierui/blocks` canonical) before the corresponding chrome slice.
- Sequencing hint: C4 (nav-list) + P2 (data-grid) + P7 (toggles) are mountable as soon as #765 relaxes (their FUI blocks exist); C1/C5/C6/C7 (shell + buttons + disclosure) wait on the must-build set.
- WE-docs branding rides the [#747](/backlog/747/) theme+intents bundle — the dogfooded components need a WE-docs theme so they don't render in FUI's own branding.
