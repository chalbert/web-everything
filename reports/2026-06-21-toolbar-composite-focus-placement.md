# Toolbar — roving-tabindex control-group placement survey

Prior-art survey grounding decision [#1409](/backlog/1409-toolbar-roving-tabindex-control-group-standard-placement/)
(surfaced by the ARIA-APG lens [#1400](/backlog/1400-discovery-lens-aria-authoring-practices-apg-pattern-diff-aga/)).
Per design-first step 1, prior art is gathered before the forks are framed so the dimensions reuse
platform vocabulary.

## The concern

A **toolbar** groups related controls (buttons, toggles, menu-buttons, separators) under one tab stop with
**roving tabindex** + arrow-key navigation between members — the APG Toolbar pattern. The card asks: own a
`toolbar` intent/block, vs a reusable **roving-tabindex behavior** (shared across toolbar / menubar /
radio-group / tabs), vs a `segmented-control` extension.

## Native grounding

[WAI-ARIA APG Toolbar](https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/): `role="toolbar"` is "a
container for grouping a set of controls." The toolbar is **one tab stop**; arrow keys move focus among
members; `aria-orientation` declares the axis; labelled via `aria-label`. APG advises it for **3+
controls**. Separators (`role="separator"`/`<hr>`) are presentational, not a focus stop.

The **two focus-management techniques** are *not* a toolbar concept — they are defined in APG's general
[Developing a Keyboard Interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/) guide that
every composite widget references: **roving tabindex** (exactly one descendant `tabindex="0"`, others
`-1`, the `0` moves with focus — real DOM focus) and **`aria-activedescendant`** (virtual focus; DOM focus
stays on the container). The same managed-focus mechanic is reused by **toolbar, radiogroup, tablist,
menu/menubar, listbox, grid, treegrid, tree** — the entire family APG calls **composite widgets**.

## Finding 1 (load-bearing) — roving focus is a shared primitive across N patterns, not a toolbar thing

Both leading headless libraries factored it into **one reused primitive**:

- [Radix UI](https://www.radix-ui.com/primitives/docs/components/toolbar) ships an internal
  `@radix-ui/react-roving-focus` (`RovingFocusGroup`, props `orientation` / `loop` / `dir`) that powers
  **Toolbar, Tabs, RadioGroup, Menu/Menubar, DropdownMenu, ToggleGroup**. Toolbar is a thin role wrapper
  over it.
- [Ariakit `Composite`](https://ariakit.org/reference/composite) is explicitly "inspired by the WAI-ARIA
  Composite Role … implements all keyboard navigation so there's only one tab stop," supports **both**
  techniques behind one flag, and the docs say "use more concrete ones like Menu, Toolbar, TabList … or
  build your own on top of Composite."

[React Aria](https://react-spectrum.adobe.com/react-aria/useToolbar.html) splits the same way:
`useFocusManager` + `FocusScope` provide the arrow-navigation engine; `useToolbar` is a small role-applying
consumer on top, and `useTabList` / selectable collections reuse the same machinery. Adobe Spectrum even
ships a standalone [`roving-tab-index`](https://opensource.adobe.com/spectrum-web-components/tools/roving-tab-index/)
tool used across components.

## Finding 2 — toolbar-the-container is genuinely thin

Across Radix / Ariakit / React Aria / MUI, what "toolbar" adds beyond the shared focus group is small:
`role="toolbar"`, `aria-orientation`, separators, a label. [MUI `<Toolbar>`](https://mui.com/material-ui/react-app-bar/)
is essentially a flex layout container (no roving by default). No library treats toolbar as the home of the
focus algorithm; the [MDN toolbar role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/toolbar_role)
confirms the toolbar *delegates to* roving tabindex, it does not define it.

## WE-tree decomposition — the focus mechanic already exists

- **[we:src/_data/intents/focus-delegation.json](../src/_data/intents/focus-delegation.json)** (status
  `draft`) already owns the entire roving-tabindex/managed-focus contract: "Protocol for composite-widget
  focus — roving tabindex vs. virtual focus (active descendant), arrow-key navigation within a widget, and
  whether selection follows focus." Dimensions: `strategy` ∈ `roving | virtual | native`, `orientation` ∈
  `vertical | horizontal | both`, `selectionFollowsFocus`, `wrap?`. It **explicitly lists toolbar as a
  consumer** ("Use when the items themselves are the interactive targets (menus, **toolbars**, radio
  groups, tabs)") and cites the APG keyboard-interface doc.
- **[we:src/_data/blocks/composite-widget.json](../src/_data/blocks/composite-widget.json)** (status
  `concept`, `type: Behavior`) is the realization twin: "Focus management and navigation protocol for
  complex widgets … implementing the Roving Tabindex pattern."
- **[we:src/_data/assemblerPresets/toolbar.json](../src/_data/assemblerPresets/toolbar.json)**
  (`ownedByProject: webdocs`, status `active`) **already exists**: "A W3C APG toolbar … roving tabindex and
  arrow-key navigation … Baseline is real `<button>`s in a `role="toolbar"`; a toolbar script layers the
  roving-tabindex arrow navigation." It declares `composesIntents: ["action","command","focus-delegation","navigation"]`
  and `intentStrategies: { "focus-delegation": "roving-tabindex" }`.
- Members all present and already delegating focus: `segmented-control` composes `focus-delegation`
  (roving, horizontal); `radio-group` / `menu` / `tabs` / `data-grid` / `dropdown` all reference it (16
  blocks total). `keyboard-shortcuts` is orthogonal (global chord normalization across shadow boundaries,
  not within-widget arrow nav).

**The unowned residual is tiny.** The focus mechanic is owned (intent + behavior block); the toolbar recipe
exists as a webdocs assemblerPreset. What is genuinely not yet first-class: (a) a `toolbar` intent/block
capturing the *container* semantics (role=toolbar, orientation-as-grouping, separators, the "3+ / avoid
arrow-pair members" guidance) as a contract rather than only an assembled preset; (b) promoting
`focus-delegation` from `draft` and `composite-widget` from `concept`.

## Recommended placement

- **Fork A — is the unit a shared managed-focus behavior or a toolbar-specific thing?** NOT a real fork:
  the "new toolbar-specific roving standard" branch is **broken/redundant** — `focus-delegation` already
  owns roving/virtual/native + orientation + wrap + selectionFollowsFocus, `composite-widget` is its
  behavior twin, 16 blocks delegate to it, and a `toolbar` preset already wires it. Creating a
  toolbar-owned roving standard would duplicate a shipped intent (exactly the factoring Radix / Ariakit /
  React Aria all rejected). Recorded as a resolved invariant (~95%): the roving unit **is**
  `focus-delegation` + `composite-widget`; toolbar is a consumer.
- **Fork B — where do the toolbar *container* semantics live (role=toolbar, orientation-as-grouping,
  separators, label, 3+/arrow-pair guidance)?** A real fork. Default (~70%): **no new intent** — toolbar =
  the existing `toolbar` assemblerPreset consuming `focus-delegation` (strategy=roving) + `action` /
  `command`; promote `composite-widget` to capture shared container behavior; container "semantics" are the
  preset's APG conformance, not a new contract. Alternative (b): a thin `toolbar` *block* (Component)
  implementing no new intent, composing `focus-delegation` + `action`, owning only role=toolbar +
  separators + orientation — first-class so menubar / future consumers can reference it. A `toolbar`
  *intent* is rejected (a toolbar carries no UX dimension of its own — orientation belongs to
  focus-delegation, grouping is layout). Residual: the moment a *second* container consumer (menubar /
  tabs container) needs shared container semantics, graduate the preset into the thin block per (b) — the
  low-regret hedge, matching Radix/Ariakit (thin toolbar over the shared focus group).

Note for the card: it understates current state — `focus-delegation` intent, `composite-widget` behavior
block, AND a `toolbar` assemblerPreset (with `intentStrategies.focus-delegation = roving-tabindex`) already
exist; the decision is placement/promotion, not greenfield. Maturation residual (not part of the fork):
`focus-delegation` is `draft`, `composite-widget` is `concept`, and 2D-grid mechanics are flagged as an
open research gap in the intent.
