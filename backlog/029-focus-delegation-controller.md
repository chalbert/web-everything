---
type: idea
status: open
dateOpened: '2026-06-02'
tags:
  - droplist
  - autocomplete
  - plateau
  - focus
  - accessibility
relatedReport: reports/2026-06-02-dropdown-trait-composition.md
---

# Add controller to FocusDelegation (focus host != collection)

Autocomplete needs DOM focus on the <input> while the active item lives in the listbox, so focus host and collection are different elements. FocusDelegation currently assumes they are the same (attaches keydown to, and sets aria-activedescendant on, its own target). Add a controller option: keydown source + aria-activedescendant move to the controller (the input), and the listbox is not made focusable. Smallest, riskiest next prototype — proving virtual focus across input->listbox. Plateau repo.
