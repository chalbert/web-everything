---
type: decision
workItem: story
size: 3
parent: "023"
status: resolved
dateOpened: '2026-06-02'
dateStarted: "2026-06-11"
dateResolved: "2026-06-11"
graduatedTo: none
codifiedIn: "docs/agent/platform-decisions.md#surface-contract-not-computation"
tags:
  - droplist
  - accessibility
  - shadow-dom
  - aria
  - architecture
relatedReport: reports/2026-06-02-native-platform-substrate.md
---

# Does the droplist contract mandate cross-root ARIA correctness?

Cross-root ARIA / Reference Target is the only substrate API with no baseline and no clean polyfill — the gap lives in the accessibility tree. If the droplist contract requires a fully accessible combobox across a shadow boundary, that forks the architecture toward light-DOM content or native base-select rather than shadow encapsulation.

## The concrete fork

A combobox needs the trigger to point `aria-activedescendant` (and `aria-controls`/`aria-owns`) at an option inside the popup listbox. When the listbox is **inside a shadow root**, that reference can't cross the boundary in the a11y tree — AT sees a broken relationship. The substrate report ([2026-06-02](../reports/2026-06-02-native-platform-substrate.md)) classifies this as **enhancement-only / "no clean shim"**: *"the one genuine accessibility blocker for shadow-encapsulated comboboxes,"* with the pragmatic fix being to keep the referenced content in **light DOM**. Reference Target (the real cross-root fix) is Chromium-flag-only, no baseline, no polyfill.

The current `frontierui/blocks/droplist/` impl has **already de facto chosen light DOM**: `Anchor`/`Anchored`/`AutoComplete`/`Selection`/`FocusDelegation` wire `aria-controls`/`aria-owns`/`aria-activedescendant` between trigger and `role=listbox` in a *shared* root, never across a shadow boundary.

## Options

- **A — Don't mandate cross-root ARIA (recommended).** The contract mandates an *accessible combobox*, achieved via one of two sanctioned a11y-bearing substrates: **light-DOM content (default)** or **native `appearance: base-select` (enhancement)**. Cross-root ARIA via Reference Target is an *optional* enhancement that, where supported, permits shadow encapsulation — but is never required, and the component must be fully accessible without it. Matches the report's "bottom-5 are enhancement-only" rule, the Native-First Default, and what frontierui already ships.
  - *Tradeoff:* shadow encapsulation of the surface is not a conformant a11y path until Reference Target reaches baseline; authors accept light-DOM (or `::part`-styled light DOM) for the listbox.
- **B — Mandate cross-root ARIA correctness.** Require the combobox be fully accessible even with a shadow-encapsulated surface. Forces either Reference Target (no baseline → fails today everywhere but flagged Chromium) or a full JS rebuild, and pushes the encapsulated case toward native `base-select`.
  - *Tradeoff:* contract is unshippable on baseline; contradicts the enhancement-only classification and the existing light-DOM impl.

## What this unblocks

Settling A vs B is the upstream fork for the droplist family: [#020 base-select first-class adapter](/backlog/020-base-select-first-class-adapter/) (base-select becomes a sanctioned enhancement path), [#064 tree-select block](/backlog/064-tree-select-block/) (same a11y model), [#018 dropdown async pagination](/backlog/018-dropdown-async-pagination-paradigm/), and the droplist-native-substrate-fork resolver tiebreak.

## Resolved — Option A, no mandated mechanism (2026-06-11)

**Decision: the droplist contract does NOT mandate cross-root ARIA correctness. It mandates the *outcome* — an accessible combobox — and leaves the *substrate* an open choice, because the substrate is internal to a module and does not cross a module boundary.**

- **Mandated (the interaction surface):** the combobox is accessible, and the trigger ↔ listbox relationship (`aria-controls`/`aria-owns`/`aria-activedescendant`, the selection/active-descendant protocol) resolves correctly to AT. This is what other modules and AT observe, so it's the contract.
- **Not mandated (internal substrate, author's choice — co-equal, no default):** *how* you achieve that accessible relationship — **light-DOM content**, native **`appearance: base-select`**, or (where it reaches baseline) **Reference Target-encapsulated shadow DOM**. The standard does not privilege one; it does not enforce a single way of doing things as long as the inter-module interaction surface holds. (Per [Minimize Lock-In / Protocol Is The Only Lock] and [Native-First Default].)
- **Consequence:** shadow-encapsulating the listbox *without* Reference Target produces a severed a11y relationship → **non-conformant**, because it breaks the mandated outcome. A is stricter on outcome, looser on mechanism; an inaccessible droplist fails conformance either way. Reference Target graduates from "required (and failing on baseline)" to "optional enhancement that unlocks encapsulation once baseline."

This ratifies what `frontierui/blocks/droplist/` already ships (light-DOM trigger↔listbox wiring in a shared root). **Unblocks** [#020](/backlog/020-base-select-first-class-adapter/) (base-select is a sanctioned co-equal substrate — promotion to a first-class adapter is now purely an ergonomics call), [#064](/backlog/064-tree-select-block/) (inherits the outcome-not-mechanism model), [#018](/backlog/018-dropdown-async-pagination-paradigm/). Enforcement (does the conformance checker actually test the trigger↔listbox a11y relationship) is a separate tooling concern, not part of this contract ruling.
