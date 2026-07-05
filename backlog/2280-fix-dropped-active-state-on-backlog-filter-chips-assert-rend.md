---
kind: story
size: 3
status: resolved
scaffoldedBy: "backlog-filter-active-state"
dateScaffolded: "2026-07-05"
dateOpened: "2026-07-05"
dateResolved: "2026-07-05"
tags: []
---

# Fix dropped active state on backlog filter chips + assert rendered selected style in Playwright

The /backlog/ facet chips (status·kind·size·tier on Tracked work, plus the Prioritisation readiness/kind chips) render EVERY chip with the selected tint regardless of pressed state: they are SSR'd with a hardcoded selected attribute and the CSS lights up on the we-filter-chip[selected] attribute, but we:src/assets/js/home-display.js and we:src/assets/js/backlog-table-sort.js drive real state via the fui-filter-chip--selected class + aria-pressed and never sync that attribute. Pre-upgrade (FUI host offline) an unpressed chip (e.g. Resolved) is visually indistinguishable from a pressed one. Existing interaction specs only assert aria-pressed/class, never the COMPUTED style, so they miss it.

## Resolution

- **CSS (we:src/css/style.css)** — the selected-tint rule keys on the `fui-filter-chip--selected` class (the source of truth both scripts maintain) instead of the stuck `we-filter-chip[selected]` attribute. One class selector styles both the pre-upgrade `<we-filter-chip>` and the upgraded `.fui-filter-chip` `<button>`, in every FUI load state.
- **SSR baseline (we:src/backlog.njk)** — default-on chips are seeded with the class so the pre-JS render is already correct; the default-off Resolved status chip now carries neither `selected` nor the class (it was previously lit).
- **Coverage (we:tests/interaction/backlog-items-filters.spec.ts, we:tests/interaction/backlog-priority-filters.spec.ts)** — the fixtures now load the real we:src/css/style.css, and new specs assert the RENDERED background: a pressed chip carries the accent tint and an unpressed one does not, and toggling a chip OFF strips its tint even though its inert SSR `selected` attribute survives. Verified as genuine guards — all three fail against the old `[selected]`-keyed CSS.
