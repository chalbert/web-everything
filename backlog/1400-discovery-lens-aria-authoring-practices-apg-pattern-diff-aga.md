---
kind: story
size: 3
parent: "1399"
status: resolved
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: none
tags: [discovery, lens, aria, apg, accessibility, gap, book-candidate]
---

# Discovery lens — ARIA Authoring Practices (APG) pattern diff against the registry

Run the [latent-standard discovery](/backlog/1399-latent-standard-discovery-lens-catalogue-each-lens-only-emit/)
discipline against the **WAI-ARIA Authoring Practices Guide** pattern list (~30 patterns: accordion, alert,
combobox, dialog, disclosure, feed, grid, listbox, menu/menubar, meter, radio-group, slider, spinbutton,
**splitter/windowsplitter**, switch, tabs, toolbar, tree, treegrid, …). Each APG pattern is a behavior
*contract* (roles + keyboard + state), so it maps cleanly to a WE intent/block. Diff each against
[we:src/_data/intents/](../src/_data/intents/) + [we:src/_data/blocks/](../src/_data/blocks/); every ❌ /
partial → a card (placement-unsure → `decision`). High-signal because APG is finite, authoritative, and
a11y-first — `role=separator` is exactly what implied the splitter in
[#1384](/backlog/1384-spatial-manipulation-arrangeable-surfaces-resizable-splitter/).

## Do

- Enumerate the current APG pattern index (cite the version/date in the report).
- For each: covered (name the intent/block) / partial / ❌.
- File a `book-candidate` card per ❌ or partial; dismiss with a one-line reason otherwise.

## Run 1 — 2026-06-21 (WAI-ARIA APG pattern index)

Diffed the ~30 APG patterns against the registry.

**Covered** (named owner): accordion → `disclosure`/`disclosure-nav`; alert / alertdialog → `notification`/`live-region-status`/`modal`; breadcrumb → `breadcrumb`; button → `button`/`action`; carousel → `carousel`; checkbox → `checkbox`; combobox → `type-ahead`/`autocomplete`+`dropdown`; dialog → `dialog`/`modal`; disclosure → `disclosure`; grid → `data-grid`; landmarks → `sectioning`/`app-shell`; link → `navigation`; listbox → `selection`+`droplist`; menu / menubar / menu-button → `menu`; radio-group → `radio-group`; slider → `slider`; spinbutton → `stepper`; switch → `toggle-switch`; table → `data-table`; tabs → `tabs`; tooltip → `tooltip`; tree → `tree-select`; **window splitter → already filed [#1384](/backlog/1384-spatial-manipulation-arrangeable-surfaces-resizable-splitter/)**.

**Gaps filed** (placement-unsure → decision):
- **Toolbar** (roving-tabindex control group) → [#1409](/backlog/1409-toolbar-roving-tabindex-control-group-standard-placement/).
- **Meter / gauge** (bounded scalar readout) → [#1410](/backlog/1410-meter-gauge-quantitative-readout-standard-placement/).
- **Treegrid** (hierarchical grid) → [#1411](/backlog/1411-treegrid-hierarchical-interactive-data-grid-standard-placeme/).

**Dismissed with reason:** *feed* → covered by progressive-loading [#1398](/backlog/1398-progressive-loading-infinite-scroll-load-more-standard-place/); *multi-thumb slider* → a `slider` dimension, not its own standard.

Next round: re-diff when the APG index version changes, or when new blocks ship.

## Done when

Every APG pattern has a covered / partial / ❌ verdict, and each non-covered verdict is a filed card or a
dismissed-with-reason line. **Round 1 complete (2026-06-21).**

## Resolved (2026-06-21, batch-2026-06-21-1385-1392)

Round 1 done-when verified: ~30 APG patterns each carry a verdict; the three ❌/gap verdicts are filed as
open `decision` cards (#1409 toolbar / #1410 meter / #1411 treegrid, all present + open) and the two
dismissals (feed → #1398, multi-thumb → slider dimension) carry reasons. Output is cards-only per the
[#1399](/backlog/1399-latent-standard-discovery-lens-catalogue-each-lens-only-emit/) discipline. Resolving
this round; a future APG-index change re-opens the lens as a new round (idempotent re-run).
