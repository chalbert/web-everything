---
kind: story
size: 5
parent: "777"
status: open
blockedBy: []
dateOpened: "2026-06-27"
dateStarted: "2026-06-27"
tags: []
---

# Migrate the /backlog/ filter pills to FUI we-filter-chip (interactive, aria-pressed JS rewrite)

Split from #1208 (taxonomy/badge half delivered there). The /backlog/ filter row + Prioritisation-table chips are interactive controls (`we:src/backlog.njk` `data-status-chip`/`data-kind-chip`/`data-size-chip`/`data-tier-chip`/`data-pready`/`data-pkind`/`data-pfilter` buttons) whose pressed-state toggle is driven by the page filter scripts (`we:src/assets/js/backlog-table-sort.js`, `we:src/assets/js/backlog-graph.js`, `we:src/assets/js/home-display.js`, `we:src/assets/js/backlog-burndown.js`) reading `aria-pressed` and mirroring it to an `.is-active` style class. FUI `we-filter-chip` self-replaces to a native `button` using `fui-filter-chip--selected` (not `.is-active`) and owns only presentation — toggle behavior stays the consumer JS — so the swap is a cross-file JS rewrite (re-key the style mirror + selectors to the upgraded button) plus live verification of every filter interaction on the running /backlog/, distinct from the decorative taxonomy swap.

`<we-filter-chip>` is already registered (the #1758 `badges-in-document` entry registers both `<we-badge>` and `<we-filter-chip>`, loaded cross-origin in `we:src/_layouts/base.njk`), and non-excluded attributes (e.g. the existing `data-*-chip` hooks) survive the transient upgrade — so the markup hooks the JS reads can be preserved; the real work is the pressed-state style mirror (`.is-active` → `fui-filter-chip--selected`) and live-verifying the localStorage-persisted filter state across every chip group.

## Build
- Swap the filter-row + Prioritisation-table **plain** chips in `we:src/backlog.njk` to `<we-filter-chip>` (`selected` for the pressed default; keep the `data-*` filter hooks). **The six summary `data-pfilter` pills are out of scope** — carved to #1874 per the #1866 ruling (they need the rich-count API #1873); leave them as hand-rolled buttons, untouched.
- Re-key the pressed-state mirror in the four page scripts from `.is-active` to the upgraded `fui-filter-chip--selected` (and add a `we-filter-chip{}` / SSR baseline if the existing one needs the new structure).
- Drop the now-dead bespoke chip CSS in `we:src/backlog.njk` once the FUI chip styles it.

## Acceptance
- Every **plain** filter group (status/kind/size/tier/readiness/split) toggles, persists to localStorage, and re-applies on reload exactly as before — verified live on the running /backlog/. (The summary pills are #1874's scope, not this item's.)
- `npm run verify` green; a real-browser check confirms the chips upgrade with no console error and no FOUC.

## Pre-flight finding (batch-2026-06-26-1806-1825) — a buried sub-fork on the summary pills; released unbuilt

Grounded the full scope before building. **Good news (de-risks the bulk):** every consuming script selects
chips by **`data-*` attribute**, never by the `.status-filter-chip` class — `we:src/assets/js/home-display.js`
keys off `[data-status-chip]/[data-kind-chip]/[data-size-chip]/[data-tier-chip]`, and
`we:src/assets/js/backlog-table-sort.js` off `[data-pready]/[data-pkind]/[data-psplit]/[data-pfilter]`. Those
`data-*` hooks **survive** the `we-filter-chip` transient upgrade (only `selected`/`count`/`value` are
excluded — `fui:blocks/filter-chip/FilterChipElement.ts`), so selectors stay stable and the only JS rewrite is
the pressed-state style mirror `.is-active → fui-filter-chip--selected` in those two scripts (the other two,
`we:src/assets/js/backlog-graph.js` / `we:src/assets/js/backlog-burndown.js`, drive graph/burndown controls,
not these filter pills). The plain filter chips (status/kind/size/tier + readiness/kind/split) are a clean,
faithful `we-filter-chip` swap.

**The sub-fork:** the Prioritisation **summary `data-pfilter` pills** (batchable / agent-ready / epics /
program / decision / not-ready) are NOT plain chips — each has a distinct semantic **background colour** and a
**rich structured count** (nested colour-coded sub-spans: "· N in flight", "· N to split", "· N ✓ prepared",
"· N preparing"). `we-filter-chip` decorate rebuilds the button from flattened `textContent` + a single
scalar `count`, which **destroys** that inner structure and colour — so converting them is **lossy**, conflicting
with the "exactly as before" acceptance. Three ways out, a real call:
1. **Scope #1825 to the plain filter chips** (faithful now); carve the summary-pill conversion to a follow-up.
2. **Extend `we-filter-chip`** first with a rich-count / variant-colour slot (a FUI change), then convert.
3. **Accept the flatten** (uniform chips, lose the per-category colour + sub-tallies).

Recommendation: **(1)** — migrate the plain chips now (the item's core, faithful), file the summary-pill
conversion as a successor needing either (2) or (3). Released `active → open` pending that scope call.

**RESOLVED by [#1866](/backlog/1866-backlog-prioritisation-summary-pill-conversion-to-we-filter-/) (2026-06-27): option (1) ratified.** This item is now **scoped to the plain chips only** (Build + Acceptance amended above). The summary-pill conversion is carved to **[#1874](/backlog/1874-convert-the-backlog-prioritisation-summary-pills-to-we-filte/)**, itself blocked on the FUI rich structured-count + colour-variant capability **[#1873](/backlog/1873-grow-we-filter-chip-a-rich-structured-count-colour-variant-a/)** — both children of #777, so the dogfood gap is tracked, not dropped. The loss is purely sequencing: once #1873 lands, #1874 restores the pills' colour + sub-counts faithfully. `blockedBy: ["1866"]` cleared — the plain-chip scope is now agent-ready.
