---
kind: story
size: 2
parent: "1257"
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: src/_data/blocks/autocomplete.json
tags: []
---

# Reconcile WE combobox-family intents with the 2025 APG combobox guidance

The WAI-ARIA APG combobox pattern was updated in 2025 — strongly recommending aria-controls over aria-owns, plus editable-combobox-with-grid-popup examples. Reconcile the combobox, dropdown, tree-select and autocomplete intents (#322, droplist aria #024) with the current APG guidance so the borrowed accessibility vocabulary stays current. Surfaced by the 2026-06-20 platform-standards watch (#1257), a11y/APG lens.

## Progress

Resolved 2026-06-20. **Audit finding: WE is already on the 2025 APG vocabulary.** The combobox-family
surfaces are blocks, not separate intents (#322 graduated to `block:autocomplete`, droplist aria #024 to
its blocks): autocomplete, dropdown, type-ahead, droplist, picker-surface, menu, inline-trigger.

- **aria-controls over aria-owns (the headline 2025 change): already satisfied.** A grep for `aria-owns`
  across we:src/_data/blocks/*.json returns **zero** hits; the combobox-family blocks already wire the
  popup with `aria-controls` (autocomplete + dropdown) plus `aria-expanded` / `aria-activedescendant` /
  `aria-autocomplete`. Nothing to migrate.
- **Recorded the currency** in we:src/_data/blocks/autocomplete.json `webStandards.ariaCombobox.usage`:
  noted the reconciliation with 2025 APG (aria-controls confirmed over the older aria-owns) and the four
  APG popup types (`listbox` = this block's default; `grid` / `tree` / `dialog` via `aria-haspopup`).
- **editable-combobox-with-grid-popup:** the 2025 APG added this example; WE has no grid-popup combobox
  member yet — recorded as a future carve (not a regression). The listbox profile stays WE's vocabulary.

So the borrowed a11y vocabulary is current; the reconciliation is a verified no-migration + a currency
note. Gate green.
