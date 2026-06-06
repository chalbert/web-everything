---
type: idea
status: open
dateOpened: "2026-06-03"
tags: [droplist, autocomplete, combobox, block, traits, filter]
relatedReport: reports/2026-06-02-dropdown-trait-composition.md
relatedProject: webblocks
crossRef:
  url: /blocks/droplist/
  label: droplist family page
---

# Author the autocomplete block standard

The autocomplete variant — editable input + filterable listbox — needs its own block.njk and blocks.json entry. It is the richest droplist member and the one whose authoring most pressure-tests the substrate: composing it surfaces the *focus host ≠ collection* distinction, the `controller` parameter on focus-delegation, the `type-ahead → filter` swap, and `filter` as a thin composition over loader + live-status.

Seed content already exists in the dropdown-trait-composition report under "Autocomplete in detail" (focus host vs collection, the controller param, type-ahead → filter, the typing trace) and in the trait-language report under "Autocomplete — swap one trait, move the focus host". Depends on landing the `controller` prototype on FocusDelegation (see [focus-delegation-controller](/backlog/focus-delegation-controller/)) before the runnable spec can be claimed.
