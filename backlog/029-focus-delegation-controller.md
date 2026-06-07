---
type: idea
status: resolved
dateOpened: '2026-06-02'
dateResolved: '2026-06-06'
tags:
  - droplist
  - autocomplete
  - plateau
  - focus
  - accessibility
relatedReport: reports/2026-06-02-dropdown-trait-composition.md
---

# Add controller to FocusDelegation (focus host != collection)

> **Resolved 2026-06-06.** Implemented in Plateau: `src/blocks/attributes/FocusDelegation.ts` now accepts a
> `controller` option (id or CSS selector) so the element carrying `aria-activedescendant` can be a separate
> host (e.g. an autocomplete input) distinct from the collection. Original narrative preserved below.

Autocomplete needs DOM focus on the <input> while the active item lives in the listbox, so focus host and collection are different elements. FocusDelegation currently assumes they are the same (attaches keydown to, and sets aria-activedescendant on, its own target). Add a controller option: keydown source + aria-activedescendant move to the controller (the input), and the listbox is not made focusable. Smallest, riskiest next prototype — proving virtual focus across input->listbox. Plateau repo.
