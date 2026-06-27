---
kind: story
size: 5
parent: "777"
status: open
dateOpened: "2026-06-27"
tags: []
---

# Migrate the /backlog/ filter pills to FUI we-filter-chip (interactive, aria-pressed JS rewrite)

Split from #1208 (taxonomy/badge half delivered there). The /backlog/ filter row + Prioritisation-table chips are interactive controls (`we:src/backlog.njk` `data-status-chip`/`data-kind-chip`/`data-size-chip`/`data-tier-chip`/`data-pready`/`data-pkind`/`data-pfilter` buttons) whose pressed-state toggle is driven by the page filter scripts (`we:src/assets/js/backlog-table-sort.js`, `we:src/assets/js/backlog-graph.js`, `we:src/assets/js/home-display.js`, `we:src/assets/js/backlog-burndown.js`) reading `aria-pressed` and mirroring it to an `.is-active` style class. FUI `we-filter-chip` self-replaces to a native `button` using `fui-filter-chip--selected` (not `.is-active`) and owns only presentation — toggle behavior stays the consumer JS — so the swap is a cross-file JS rewrite (re-key the style mirror + selectors to the upgraded button) plus live verification of every filter interaction on the running /backlog/, distinct from the decorative taxonomy swap.

`<we-filter-chip>` is already registered (the #1758 `badges-in-document` entry registers both `<we-badge>` and `<we-filter-chip>`, loaded cross-origin in `we:src/_layouts/base.njk`), and non-excluded attributes (e.g. the existing `data-*-chip` hooks) survive the transient upgrade — so the markup hooks the JS reads can be preserved; the real work is the pressed-state style mirror (`.is-active` → `fui-filter-chip--selected`) and live-verifying the localStorage-persisted filter state across every chip group.

## Build
- Swap the filter-row + Prioritisation-table + summary (`data-pfilter`) buttons in `we:src/backlog.njk` to `<we-filter-chip>` (`selected` for the pressed default; keep the `data-*` filter hooks).
- Re-key the pressed-state mirror in the four page scripts from `.is-active` to the upgraded `fui-filter-chip--selected` (and add a `we-filter-chip{}` / SSR baseline if the existing one needs the new structure).
- Drop the now-dead bespoke chip CSS in `we:src/backlog.njk` once the FUI chip styles it.

## Acceptance
- Every filter group (status/kind/size/tier/readiness/split/summary) toggles, persists to localStorage, and re-applies on reload exactly as before — verified live on the running /backlog/.
- `npm run verify` green; a real-browser check confirms the chips upgrade with no console error and no FOUC.
