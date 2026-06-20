---
kind: story
size: 3
parent: "604"
status: resolved
blockedBy: ["733"]
dateOpened: "2026-06-16"
dateStarted: "2026-06-16"
dateResolved: "2026-06-16"
graduatedTo: none
tags: []
---

# Roll out the fuiDemo embed to the remaining WE blocks whose FUI demo already exists

Apply #733's one-line {% fuiDemo %} pattern across the blocks with an existing FUI-hosted demo: for-each (we:for-each-demo.html), tabs (we:view-tabs-demo.html), interpolation-text-node (we:text-interpolation-demo.html), nav-list/nav-section (we:navigation-demo.html), conditional-view (fui:visibility-gate.html), tooltip (fui:positioning-shift.html). One line each in the description partial; static code sample retained. Full coverage of demo-less blocks stays external-gated (#705/#398).

## Progress

Applied the #733 `{% fuiDemo %}` "Try it live" pattern (one embed line + the standard FUI-hosted note, static samples retained) to all 6 demos, each on its **live, registered** block page:

- for-each → `we:for-each-demo.html` (we:for-each.njk)
- tabs → `we:view-tabs-demo.html` (we:tabs.njk)
- interpolation-text-node → `we:text-interpolation-demo.html` (we:interpolation-text-node.njk)
- nav-list (Navigation) → `we:navigation-demo.html` (we:nav-list.njk)
- tooltip → `fui:positioning-shift.html` (we:tooltip.njk)
- conditional-view → `fui:visibility-gate.html` placed on **view.njk** (see below)

**Premise correction (mid-work):** `conditional-view` and `nav-section` are **not** registered blocks in `fui:blocks.json` (we:block-pages.njk paginates that data; the `_site/blocks/conditional-view/` dir is a stale artifact). So:
- `nav-section` is folded into the Navigation page — `we:navigation-demo.html` is already surfaced on nav-list, so no separate embed (would have been a dead/duplicate partial).
- `conditional-view` is subsumed by the `view` block ("foundation for all show/hide/render"); the visibility-gate demo is embedded on `we:view.njk`, which cross-links to `/blocks/conditional-view/`.

All 6 embeds verified rendering in the 11ty build; `check:standards` 0 errors.
