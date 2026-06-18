---
type: idea
workItem: task
status: resolved
dateOpened: "2026-06-11"
dateStarted: "2026-06-12"
dateResolved: "2026-06-12"
graduatedTo: blocks/renderers/pagination/PaginationBehavior.ts (FocusLanding + applyLanding)
tags: [pagination, a11y, focus, autofocus-on-activation, collection-ops]
---

# Move focus per landing (default heading) after a pagination page change

Move focus after a pagination page change by composing `autofocus-on-activation`'s `landing` contract against the results region, default `landing: heading` (the results heading made focusable via `tabindex="-1"` + `.focus()`). The other values cover every debated option: `target` (author-named element), `preserve` (stay on the control — the rapid-paging opt-in, natural for `append`), `auto` (full `?page=n` reload — browser handles focus). The renderer currently never moves focus (`we:renderPagination.ts:78`). Ratified in #059 (Fork 1): a page change is a surface activation; the APG answer is the heading, and the atom is already owned and composed by `navigation` — no pagination-private focus vocabulary.

## Progress

**Resolved 2026-06-12** → `we:blocks/renderers/pagination/PaginationBehavior.ts`.

Added the `FocusLanding = 'heading' | 'target' | 'preserve' | 'auto'` type (the composed `autofocus-on-activation` `landing` contract — landing only, no trap) plus `applyLanding(kind)`, called on every `goto()`:
- **`heading`** (default for `goto`) — finds a heading (`h1`–`h6` / `[role=heading]`) in the declared `results` region, makes it focusable (`tabindex="-1"`) and focuses it; falls back to the region container.
- **`target`** — focuses the author-supplied `focusTarget`.
- **`preserve`** — moves nothing; **the fixed behavior for `load-more`** (rapid paging stays on the control), and the opt-in for `append`.
- **`auto`** — defers to the browser (a full `?page=n` reload focuses itself).

New options on `PaginationBehaviorOptions`: `landing`, `results`, `focusTarget`. The behavior owns the pagination controls, not the page layout, so heading landing requires the consumer to declare its `results` region (a safe no-op otherwise) rather than guessing. Tests: focus lands on the results heading (`tabindex=-1`, `document.activeElement`) after a `goto`; a `load-more` change leaves focus untouched. 22 pagination tests green; `check:standards` green.
