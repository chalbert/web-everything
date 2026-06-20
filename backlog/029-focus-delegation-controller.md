---
kind: task
parent: "023"
status: resolved
dateOpened: '2026-06-02'
dateResolved: '2026-06-06'
graduatedTo: frontierui/blocks/droplist/FocusDelegation.ts
tags:
  - droplist
  - autocomplete
  - plateau
  - focus
  - accessibility
relatedReport: reports/2026-06-02-dropdown-trait-composition.md
---

# Add controller to FocusDelegation (focus host != collection)

> **Resolved 2026-06-06.** Implemented in Plateau: `we:src/blocks/attributes/FocusDelegation.ts` now accepts a
> `controller` option (id or CSS selector) so the element carrying `aria-activedescendant` can be a separate
> host (e.g. an autocomplete input) distinct from the collection. Original narrative preserved below.

Autocomplete needs DOM focus on the `<input>` while the active item lives in the listbox, so focus host and collection are different elements. FocusDelegation currently assumes they are the same (attaches keydown to, and sets aria-activedescendant on, its own target). Add a controller option: keydown source + aria-activedescendant move to the controller (the input), and the listbox is not made focusable. Smallest, riskiest next prototype — proving virtual focus across input->listbox. Plateau repo.

**Graduated to** `fui:frontierui/blocks/droplist/FocusDelegation.ts` — controller option (focus host ≠ collection) — originally plateau-era we:src/blocks/attributes/FocusDelegation.ts (legacy plateau repo, now abandoned); verified live successor in frontierui.
