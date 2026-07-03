---
kind: epic
parent: "777"
status: resolved
blockedBy: []
dateOpened: "2026-07-01"
dateResolved: "2026-07-03"
tags: [dogfood, fui, ssr, detail-pages, epic]
---

# Dogfood the WE-docs detail-page + content templates onto WE components (sweep)

## Digest

Beyond the catalog index pages, every **detail** and **content** template is still 100% hand-rolled — the
real surface is **13 detail generators** (`we:src/adapter-pages.njk`, `we:src/backlog-pages.njk`,
`we:src/block-pages.njk`, `we:src/capability-pages.njk`, `we:src/capability-adapter-pages.njk`,
`we:src/demo-pages.njk`, `we:src/intent-pages.njk`, `we:src/plug-pages.njk`, `we:src/project-pages.njk`,
`we:src/research-topic-pages.njk`, `we:src/resource-pages.njk`, `we:src/rules-pages.njk`,
`we:src/state-pages.njk`) **+ 3 content pages** (`we:src/research.njk`, `we:src/semantics.njk`,
`we:src/demos.njk`), ~1,640 lines with zero `we-*` usage. This epic sweeps their card/badge/tag chrome onto
SSR `we-card`/`we-badge` (via #2016), so the whole site — not just the catalog indexes — renders from our
own components. Sliced 2026-07-02 (`we:reports/2026-07-02-backlog-split-analysis.md`): the chrome is
cross-cutting, so the slices are foundation-first, not one-per-family.

## Slices (the DAG)

- **#2098** — generic SSR card/badge primitive for templates (`weCard`/`weBadge` macros + per-page splice
  transform batching through `renderComponents`; proof-of-life on `we:src/semantics.njk`). Foundation.
- **#2099** — shared detail-header status → SSR `we-badge` (+ meter) via the one shared
  `we:src/_includes/project-status.njk` macro (serves 10 templates at once). `blockedBy #2098`.
- **#2100** — `we:src/block-pages.njk` panels (the 456-line generator). `blockedBy #2098`.
- **#2101** — `we:src/intent-pages.njk` panels + implementing-blocks grid. `blockedBy #2098`.
- **#2102** — `we:src/backlog-pages.njk` panels; header keeps the #2018-converted shared badge macros
  (tile ⊆ detail parity). `blockedBy #2098, #2018`.
- **#2105** — rich sweep: capability / capability-adapter / demo / research-topic pages.
  `blockedBy #2098, #2099`.
- **#2106** — thin sweep: adapter / plug / resource / state / rules / project pages.
  `blockedBy #2098, #2099`.
- **#2103** — content pages: `we:src/research.njk` tiles + `we:src/demos.njk` grid. `blockedBy #2098`.

## Scope boundaries

- **Tables are out — by ruling, not by waiting.** #1964 is resolved (contract-or-revert, applied by
  #2027): presentational doc tables stay plain `<table class="data-table">` — their ratified end-state —
  and a table that should be sortable gains the #1867 `data-*` contract as its own item, never inside a
  card slice.
- `we:src/governance.njk` belongs to #2020; the shared backlog badge macros belong to #2018.
- Each slice: independent, dev-ready, Playwright before/after, JS-off baseline correct.

## Acceptance (epic)

- Every child slice resolved; a repo-wide check shows no hand-rolled card/badge/tag surfaces remain in the
  detail/content templates outside plain-`<table>` content (its #1964 end-state).
- Feeds the per-page rollout ratchet #867.

## Notes

- Depends on #2016 (resolved). Companion to the ratchet story #867.
