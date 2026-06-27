---
kind: decision
parent: "777"
status: open
dateOpened: "2026-06-27"
dateStarted: "2026-06-27"
preparedDate: "2026-06-27"
relatedReport: reports/2026-06-27-backlog-filter-chip-rich-count-dogfood.md
tags: [dogfood, filter-chip, backlog, webdocs, fui]
---

# Backlog Prioritisation summary-pill conversion to we-filter-chip — the lossy structured-count tradeoff

A sub-fork blocking [#1825](/backlog/1825-migrate-the-backlog-filter-pills-to-fui-we-filter-chip-inter/) under dogfood epic [#777](/backlog/777-dogfood-the-we-docs-website-on-fui-components-rework-the-sit/). The `/backlog/` plain filter chips swap cleanly to FUI `we-filter-chip`, but the six **Prioritisation summary pills** carry a per-pill semantic background colour and a rich structured count (nested colour-coded sub-spans) the component provably cannot represent today. **Recommendation: scope #1825 to the clean-swap plain chips now and carve the summary-pill conversion to a tracked follow-up** that is itself gated on growing `we-filter-chip` a rich-count API — the true end-state for #777's dogfood.

## The axis — what is genuinely open, grounded in both trees

Two structurally different controls share the Prioritisation row. The **plain** chips (status/kind/size/tier/readiness/split, `we:src/backlog.njk:451-452`) are flat label + optional scalar count, selected by `data-*` attributes that survive the custom-element upgrade — a clean, faithful swap. The six **summary** pills (`data-pfilter`, `we:src/backlog.njk:394-401`) each carry **(a)** a distinct hard-coded semantic background colour and **(b)** a rich structured count of nested colour-coded sub-spans: the `decision` pill alone shows green `✓ prepared`, blue `in flight`, purple `preparing` (`we:src/backlog.njk:399`); `batchable` shows a light-blue `N in flight` (`we:src/backlog.njk:395`). These sub-counts are **actionable at-a-glance batch signals**, not decoration. The FUI component (`fui:blocks/filter-chip/FilterChipElement.ts`) flattens `textContent` and **overwrites `el.innerHTML`** in `decorate()` (`fui:blocks/filter-chip/FilterChipElement.ts:40`) — erasing any authored child sub-spans even though `fui:blocks/transient/TransientElement.ts:68` moves them in first — exposes only a single scalar `count` attribute (`fui:blocks/filter-chip/FilterChipElement.ts:43-49`), and has no slot, Shadow DOM, or colour-variant API. So a faithful summary-pill conversion is impossible without first extending the component. This collides head-on with #1825's *"every filter group toggles/persists/re-applies exactly as before"* acceptance.

## Recommended path at a glance

| Concern | Shape | Recommended | Why |
|---|---|---|---|
| **Plain filter chips** | clean swap | **Convert under #1825 now** | Flat label + scalar count is exactly `we-filter-chip`'s shape; `data-*` survive the upgrade. |
| **Summary pills** | genuine fork | **(1) scope out of #1825; carve to a tracked follow-up gated on a `we-filter-chip` rich-count API** | The component can't represent them today; forcing it now is lossy (breaks "exactly as before") or bundles a FUI component-design lift into #1825. |
| **#777 dogfood completeness** | required amendment | **File option (2) as a child of #777 + name it the carved follow-up's blocker before #1825 closes** | Else "scope later" is structurally a permanent omission of six hand-rolled pills from the dogfood. |

## Fork 1 — how to reconcile the summary pills with #1825's "exactly as before"

*Fork-existence:* a real either/or on what #1825 ships — the branches are mutually exclusive (you cannot both convert the pills now *and* keep them exactly as before, given the component's `innerHTML` clobber), and option (3) is a positively flawed branch.

- **(1) Scope #1825 to the plain chips; carve the summary-pill conversion** *(default).* #1825 converts only the clean-swap family and meets "exactly as before" faithfully. The summary-pill conversion becomes a follow-up **blocked on** a `we-filter-chip` rich/structured-count capability (option 2). *Required amendment (skeptic):* that follow-up — and the FUI capability it needs — must be **filed as a concrete child of #777 and named as the follow-up's blocker before #1825 closes**, so the dogfood gap is tracked, not silently dropped.
- **(2) Extend `we-filter-chip` to carry rich/structured counts** (a `rich-count` slot or structured sub-count API) first, then convert all pills. The true #777 end-state (the whole point is the site renders FUI components), but a FUI component-design investment that would gate #1825's otherwise-clean swap behind a larger lift. Best sequenced *after* #1825, as the carved follow-up above.
- **(3) Accept the lossy flatten** — convert now, collapsing the sub-counts to a scalar and dropping the per-pill colour. **Flawed branch:** violates #1825's "exactly as before" and discards actionable signal (prepared-vs-preparing-vs-in-flight is what a solo dev reads to pick the next decision). Rejected.

*Skeptic: SURVIVES-WITH-AMENDMENT → default (1) holds. Verified `decorate()` clobbers `el.innerHTML` (`fui:blocks/filter-chip/FilterChipElement.ts:40`), so the carve is the only faithful move; confirmed option (3) is genuinely the flawed branch (the sub-counts are actionable, not cosmetic) and a probed 4th option — composing multiple chips per pill — breaks the one-`data-pfilter`-toggle semantics. Amendment folded into the default: the option-2 capability must be filed and hard-linked as a child of #777 before #1825 closes, else the carve is indistinguishable from permanent omission.*

## Lineage

Opened 2026-06-27 as the summary-pill sub-fork [#1825](/backlog/1825-migrate-the-backlog-filter-pills-to-fui-we-filter-chip-inter/) surfaced in its pre-flight (the plain chips are a clean swap; the summary pills are not). Prepared 2026-06-27: both-tree survey of the pill markup vs the `we-filter-chip` API, published as research topic `backlog-filter-chip-rich-count-dogfood` and report [we:reports/2026-06-27-backlog-filter-chip-rich-count-dogfood.md](reports/2026-06-27-backlog-filter-chip-rich-count-dogfood.md). Sits under the badge/chip dogfood line [#1208](/backlog/1208-dogfood-the-backlog-badges-chips-onto-fui-badge-filter-chip-/). Ratifying unblocks #1825.
