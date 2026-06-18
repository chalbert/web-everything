---
type: idea
workItem: task
parent: "623"
status: resolved
blockedBy: ["826"]
dateOpened: "2026-06-17"
dateStarted: "2026-06-17"
dateResolved: "2026-06-17"
graduatedTo: src/_data/blocks.json (webStandards on 46 blocks → 75/75)
tags: []
---

# Backfill webStandards a11y metadata on the blocks still missing it (46/75)

Authoring task: populate the optional webStandards field ({concern:{usage,reference}}) on the ~46 of 75 blocks that lack it, so the #826 Accessibility & Web Standards panel renders for them too. Per the #803 ruling, sparse coverage is a prioritisation input for WHEN to author, not a branch of the sourcing decision — separately prioritised, lands incremental value once the panel (#826) ships. Each concern's reference should point at the contract (MDN/APG/WAI), matching the existing 29/75 (e.g. wizard.webStandards at fui:blocks.json:25).

## Progress

Resolved 2026-06-16. Backfilled `webStandards` on all 46 blocks that lacked it → **75/75 coverage**.
- Each entry uses the `{concern:{usage,reference}}` shape (#803 SoT), `usage` + `reference` so the #826/#828 panel renders. References point at the governing contract — WAI-ARIA APG patterns (listbox, combobox, menu, dialog-modal, slider-multithumb, radio, treeview, carousel, breadcrumb, tooltip), MDN platform docs (HTMLDialogElement, Popover API, Trusted Types, CustomEvent, `<template>`, `<time>`, `Intl.Collator`, `Array.toSorted`, `KeyboardEvent.key`, container queries, native input types), and W3C WAI practices (roving tabindex, date-picker dialog example).
- Concern keys reuse the established vocabulary where it fit (rovingTabindex, ariaCombobox, ariaListbox, ariaLive, constraintValidation, trustedTypes, htmlTemplate, intlCollator, …); UI blocks map to their a11y pattern, infra/runtime blocks (parsers, stores, trusted-html, collection-operations) to the platform primitive they realize.
- Spliced into `fui:src/_data/blocks.json` via bracket-matched text insertion (no full re-stringify — keeps the diff localized to pure additions, per the mixed-escaping footgun). Verified via a scratch 11ty build that the panel renders on a backfilled block (`dialog`).
