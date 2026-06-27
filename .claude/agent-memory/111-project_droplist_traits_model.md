---
name: project_droplist_traits_model
description: "Droplist trait-composition model — droplist is the abstract family, dropdown a concrete member; traits surface 3 ways; intent coding is HTML-first"
metadata: 
  node_type: memory
  type: project
  originSessionId: 88b1b4f5-4f84-4bb7-b9cc-f9597413c005
---

Dropdown-family work is being modeled as **trait composition**, designed in `reports/2026-06-02-dropdown-trait-composition.md`.

**Terminology (don't get backwards):** **Droplist** = the *abstract* family/substrate any list-based selection surface conforms to (dropdown, autocomplete, multi-dropdown, menu-button, native `<select>`). **Dropdown** = one *concrete* member (single-select, button-triggered). Concrete members are presets over the same dimension space — like `<select>` vs `<select multiple>`. (`droplist.njk` still says "a 'dropdown' is a composition" — wording bug, should say droplist.)

**"Intent coding" means HTML-first:** the author writes declarative markup; that markup resolves to composable `with[Capability]` traits (the `resource-loader` `TraitHandle{cleanup()}` contract). A trait surfaces three ways: **component** (custom element, owns subtree), **behavior** (custom attribute, stacks on semantic HTML), or **provider** (DI via `customContexts:*` injector chain).

**Already real:** `type-ahead` behavior (`blocks/type-ahead/`) and Plateau's `composite-widget` attribute. The latter was **split** (2026-06-02 experiment) into two independent behaviors — `plateau/src/blocks/attributes/FocusDelegation.ts` + `Selection.ts` — coordinating only via DOM (`aria-activedescendant`/`aria-current`) + the `activedescendantchange` event; proven by `FocusDelegationSelection.split.test.ts` (14 green). Findings: keyboard model partitions cleanly (arrows/seek=focus, Enter/Space=selection, Space excluded from type-ahead); activation order matters (selection must connect before focus). Remaining: collapse `composite-widget` into a thin bundle composing the two (its old test is pre-existing red). Most droplist paradigms map to behaviors; `withAnchoredSurface` is the highest-leverage *unbuilt* one.

**Element granularity — RULED 2026-06-08 (backlog #023 contract 4):** family members are **distinct custom elements** (`<auto-complete>`, `<multi-select>`, `<tree-select>`), **not** presets of one configurable `<drop-list>`. `<drop-list>` stays **as light as possible with no variant code**; the composition of the target/custom list is owned **inside each higher-level element**, which assembles its own fixed trait set. (Rejected: attribute-dimensions on one element, and sugar-aliases that desugar to `<drop-list>`.) So the abstract-family/concrete-member model is a *conceptual* hierarchy, not a single runtime element with toggles. Unblocks #138 (`<auto-complete>`), #064 (`<tree-select>`).

**Why:** keeps the dropdown a thin assembler over reusable intents (anchor, focus-delegation, selection, type-ahead, etc.) instead of a monolith. See [[feedback_harvest_cross_cutting_paradigms]], [[feedback_native_first_default]], [[feedback_dimension_vs_fixed_mechanic]].
