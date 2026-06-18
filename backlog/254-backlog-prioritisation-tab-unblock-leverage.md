---
type: idea
status: resolved
workItem: story
size: 3
dateOpened: "2026-06-09"
dateStarted: "2026-06-09"
dateResolved: "2026-06-09"
graduatedTo: none
blockedBy: ["248"]
tags: [backlog, tooling, ui, prioritisation]
---

# A "Prioritisation" tab on `/backlog/` — rank open items by how many others they unblock

`/backlog/` has two tabs today — **Tracked work** and **Burndown**
([we:src/backlog.njk](src/backlog.njk), switched by [we:src/assets/js/backlog-burndown.js](src/assets/js/backlog-burndown.js)).
Neither answers the question a planner actually asks: *which item, if resolved, frees the most other
work?* That leverage is computed today only inside the `next-backlog-item` skill's decision-mode, ad-hoc
in prose, re-derived every time and invisible on the UI. This makes it a deterministic, visible third
view.

The dependency *data* already exists: #248 added `blockedBy` edges and the loader
([we:src/_data/backlog.js](src/_data/backlog.js)) resolves them into a per-item `blockers` array. What's
missing is the **reverse** edge — for each item, *who depends on it* — and a ranking over that.

## Build

- **Loader** ([we:src/_data/backlog.js](src/_data/backlog.js)): after `blockers` are resolved, derive the
  inverse `dependents` array (every item whose `blockedBy` names this one) — the same lightweight
  `{ id, num, slug, title, status }` shape, no cyclic refs. Then derive an **unblock-leverage** score:
  - `directUnblocks` — count of `open` items directly blocked by this one.
  - `transitiveUnblocks` — count of `open` items reachable along the reverse-dependency chain (the full
    set this item ultimately gates). Compute deterministically (memoised DFS over the edge set, cycle-safe);
    identical across rebuilds, no LLM.
  - An item only "unblocks" the dependent once it is its *last* open blocker — surface both the raw count
    and the "would become Tier A if resolved" subset so the ranking reflects real freed work, not just edges.
- **Index UI** ([we:src/backlog.njk](src/backlog.njk)): add a third tab `data-bd-tab="priority"` +
  `#panel-priority` alongside tracked/burndown. List **open** items ranked by leverage (transitive desc,
  then direct desc, then NNN), each row showing: the item, its tier chip (reuse the #249 `tierBadge`
  macro), how many it directly/transitively unblocks, and the dependents it would free. Items that unblock
  nothing drop to the bottom or are hidden behind a "show all" toggle.
- **Tab JS** ([we:src/assets/js/backlog-burndown.js](src/assets/js/backlog-burndown.js)): extend the
  `panels` map with `priority: document.getElementById('panel-priority')` — the existing `data-bd-tab`
  switch + `TAB_KEY` persistence then covers it with no new wiring.

## Acceptance criteria

- The loader derives `dependents` + a deterministic unblock-leverage score from structured `blockedBy`
  edges only (no body parsing); identical across rebuilds.
- `/backlog/` has a third "Prioritisation" tab that lists open items ranked most-unblocking-first, showing
  each item's direct/transitive unblock counts and which items it would free.
- An item that is itself blocked still appears, but the ranking makes the highest-leverage *unblocked*
  items (or the one decision/prereq that frees the most) easy to spot.

## Notes

- Pairs with the relationship-graph view (#255), which reuses this item's reverse-edge (`dependents`) data
  for a visual node/edge diagram — kept as a separate story so the ranking ships without waiting on the viz.

## Progress

- **Status:** resolved (2026-06-09)
- **Branch:** docs/standard-authoring-workflow
- **Done:**
  - **Loader** ([we:src/_data/backlog.js](src/_data/backlog.js)): a reverse-edge pass after `blockers`/`tier`
    inverts `blockedBy` into per-item `dependents`, then derives `directUnblocks` (open direct dependents),
    `transitiveUnblocks` (cycle-safe memoised DFS over the reverse graph — every open item it ultimately
    gates), `unblocksToReady` (open issue/idea dependents this is the *last* open blocker for), and a
    `leverageScore` composite (`transitive*1000 + direct`) for a deterministic template sort. Pure function
    of structured edges only — no body parsing, no LLM.
  - **Index UI** ([we:src/backlog.njk](src/backlog.njk)): a third `data-bd-tab="priority"` tab + `#panel-priority`
    ranking open items by `leverageScore` desc — table with **Frees now** (unblocksToReady), **Gates (chain)**
    (transitive), **Direct**, and the **Would free** dependent #links, plus the #249 `tierBadge` so you can
    see whether the high-leverage item is itself startable or a blocker to clear first. Items that gate no
    open work are omitted; empty-state handled.
  - **Tab JS** ([we:src/assets/js/backlog-burndown.js](src/assets/js/backlog-burndown.js)): added `priority` to
    the `panels` map — the existing `data-bd-tab` switch + keyboard nav + `TAB_KEY` persistence cover it with
    no new wiring.
  - **Tests** ([we:src/_data/__tests__/backlog-leverage.test.ts](src/_data/__tests__/backlog-leverage.test.ts)):
    7 invariant tests (inverse-edge correctness, count nesting, leverageScore formula, determinism) — all green.
    `check:standards` 0 errors.
- **Next:** none — resolved. Graph view follow-up is #255 (already open, `blockedBy: 254`).
- **Notes:** verified via a standalone 11ty build (all 3 tabs + ranked table render). The live dev server was
  started before these edits and didn't hot-rebuild the `.njk`; a manual restart (your server, left as-is) or
  watcher nudge will surface it live.
