---
kind: decision
size: 5
status: resolved
dateOpened: "2026-06-07"
dateResolved: "2026-06-11"
graduatedTo: none
codifiedIn: "docs/agent/platform-decisions.md#compose-intent-dont-duplicate"
preparedDate: "2026-06-11"
tags: [block, menu, menubar, context-menu, command, aria, candidate, harvest]
relatedProject: webblocks
relatedReport: reports/2026-06-11-menu-menubar-block.md
crossRef:
  url: /blocks/droplist/
  label: "droplist family (Fork G — menu-button mis-home)"
---

# Menu / menubar / context-menu block (action commands, not value selection)

A first-class **Menu block** for invoking *commands* — the ARIA `menu`/`menubar`/`menuitem` family — distinct from the droplist family, which are value **selects** (combobox/listbox). No design exists yet; the trait selections for invocation, focus, the three shapes, checkable items, and submenus must be ruled on before a block standard can be written. The seven forks below are grounded in a prior-art survey (WAI-ARIA APG, native `<menu>`/Popover/Invoker Commands API, Radix/Headless-UI/MUI/Fluent/Carbon/Ant/Shoelace), published as the [Menu / Menubar / Context-menu](/research/menu-menubar-context-menu/) research topic. Each names a recommended default in **bold**.

The platform — and every surveyed library — separates three concerns a value-select does **not**: **invocation** (what an item *does* — a command, not a committed value), **checkable state** (`aria-checked` on `menuitemcheckbox`/`menuitemradio`), and **submenu disclosure** (`aria-expanded`). The droplist substrate is a listbox/combobox value-selector ([fui:blocks.json:21](../src/_data/blocks.json#L21)); a menu is a `role=menu` of commands. The constellation already owns the surface/focus/type-ahead/selection/disclosure/prominence intents ([anchor](../src/_data/intents.json#L1197) · [focus-delegation](../src/_data/intents.json#L54) · [type-ahead](../src/_data/intents.json#L1432) · [selection](../src/_data/intents.json#L1059) · [disclosure](../src/_data/intents.json#L1809) · [action](../src/_data/intents.json#L854)); the **one** missing piece is command invocation — the `command` intent that [#016](/backlog/016-gap-9-webcommands-project/) just resolved into existence but which is not yet built.

## Recommended path at a glance

Ratify every row, or override the one you'd change. The **confidence** column says where judgment is actually needed.

| Fork | Recommended default | Main alternative | Confidence |
|---|---|---|---|
| **A · invocation home** | each item composes the new `command` intent (#016) | overload Action / Selection *(rejected)* | **High** — every library separates invocation from value |
| **B · focus model** | `roving` + `independent`, **fixed** (override family `virtual`) | keep it a dimension (`virtual` opt-in) | **High** — APG permits both; all libraries ship roving |
| **C · the three shapes** | one block, `shape: menubar \| menu \| context` | three separate blocks (Radix-style) | **Med-high** — both are real packaging; platform machinery favors one |
| **D · checkable items** | reuse Selection under a `checkable` trait | menu-specific checked state *(rejected)* | **High** — Fluent/Carbon/Radix consensus |
| **E · submenu nesting** | Disclosure + Anchor + Right/Left keys | reuse tree-select `hierarchy` intent *(rejected)* | **High** — cascading popup ≠ data hierarchy |
| **F · separator / group** | the Menu block owns them directly | — (item omitted a home) | **High** — first-class APG roles, low-stakes |
| **G · "Menu button" double-home** | #173 claims the trigger; demote droplist's entry | leave it in the droplist roster | **Med** — real category error; fix touches the droplist roster |

## Fork A — where command invocation lives (the menu's thesis)

A menu item *invokes an action*; that is a different paradigm from committing a value, and it's the whole reason the menu warrants its own block. Native substrate: the now-Baseline `command`/`commandfor` + `CommandEvent` (a menu action is a custom `--`-prefixed command).

- **(A1 — recommended) The new `command` intent** ([#016](/backlog/016-gap-9-webcommands-project/)), composed by every menu item. Cost: depends on #016 being authored first — the one net-new dependency (sequence #016 before/with #173).
- **(A2) Overload the [Action intent](../src/_data/intents.json#L854).** *Rejected* — Action owns visual *weight* (`primary`/`destructive`), not invocation semantics; a menu item composes *both* (command = what it does, action = how prominent).
- **(A3) Overload Selection.** *Rejected* — invocation ≠ committing a value; conflating them dissolves the menu-vs-select distinction this block exists to draw.

## Fork B — focus model (corrects the item's false premise)

The item claims menus *mandate* roving tabindex. **That is wrong:** APG permits roving tabindex **or** `aria-activedescendant` for menus, with no menu-specific preference. WE *chooses* roving by convention.

- **(recommended) `focus-delegation.strategy = roving`, `selectionFollowsFocus = independent`, as a FIXED menu mechanic** — overriding the droplist family's `virtual` default. This is what Radix/Headless/MUI/Fluent all ship. Per dimension-vs-fixed-mechanic, this is *not* a configurable axis: there is no legitimate desktop-menu end-state that uses `virtual` (the only `virtual` case — a giant virtualized menu — is out of scope).
- **(alt) Keep it a dimension** (`virtual` opt-in). *Rejected* — over-configurable; exposes a branch with no real end-state.

## Fork C — the three shapes (packaging)

Menubar, popup menu, and context menu share the entire item/role/keyboard machinery; they differ only in summoning (always-visible / trigger-click / pointer+Shift+F10) and orientation.

- **(C1 — recommended) One Menu block, `shape: menubar | menu | context` + derived `orientation`.** Matches Carbon/Ant and the platform's shared role machinery (menubar just adds `tabindex=0` on its first item; context binds the `contextmenu` event + Shift+F10). Default `shape = menu`.
- **(C2) Three separate blocks** (Radix-style). *Trade:* triples the surface for one item/keyboard model where only the summoning differs.

## Fork D — checkable items

`menuitemcheckbox`/`menuitemradio` are genuine `aria-checked` selection state, not invocation.

- **(recommended) Reuse the [Selection intent](../src/_data/intents.json#L1059) under a `checkable` trait** — `model=single` → radio group, `model=multiple` → independent checkboxes. Plain `menuitem` carries **no** Selection (pure `command`). Matches Fluent/Carbon/Radix.
- **(alt) Menu-specific checked state.** *Rejected* — duplicates Selection's existing `aria-checked` / single-vs-multiple machinery.

## Fork E — submenu nesting

- **(recommended) Compose the [Disclosure intent](../src/_data/intents.json#L1809)** (`aria-expanded` on the parent `menuitem` + `aria-haspopup=menu`), with the cascade owned by the menu keyboard model (Right opens / Left closes) and each submenu its own [Anchor](../src/_data/intents.json#L1197)ed surface.
- **(alt) Reuse the tree-select `hierarchy` intent** ([#064](/backlog/064-tree-select-block/) → #295). *Rejected* — `hierarchy` owns flatten-to-visible-rows + `aria-level/setsize/posinset` + cross-level Up/Down traversal; a submenu has none of these (it's a fresh anchored surface navigated by Right/Left). Different paradigm.

## Fork F — separator & group semantics (the item omitted a home)

`role=separator` (non-focusable divider) and `role=group` (labelled section) are first-class APG menu roles every library ships, but the item assigns them no home.

- **(recommended) The Menu block owns `separator`/`group` directly.** The labelled-group case may lean on Selection's existing `grouping` dimension for the heading/`aria-labelledby` wiring; otherwise no cross-cutting reuse. Add to scope explicitly.

## Fork G — "Menu button" is mis-filed in the droplist family (the item didn't notice)

[fui:blocks.json:21](../src/_data/blocks.json#L21) and :36 list **"Menu button"** as a *droplist family member*, but the droplist substrate is a listbox/combobox **value-selector** — a true menu button opens a `role=menu` of *commands*. The constellation currently has two contradictory homes for "menu button."

- **(recommended) #173 claims the menu-button trigger** (a button with `aria-haspopup=menu`/`aria-expanded` opening into the Menu block) and **removes / demotes** the droplist "Menu button" entry to "the trigger shape only; surface owned by the Menu block."
- **(alt) Leave it in the droplist roster.** *Rejected* — perpetuates the category error.

## Ratified (2026-06-11)

All seven forks ratified at their recommended defaults (research published at [/research/menu-menubar-context-menu/](/research/menu-menubar-context-menu/)):

- **A → the `command` intent ([#016](/backlog/016-gap-9-webcommands-project/)/#299):** items compose `command` for invocation; Action stays orthogonal (prominence). Selection/Action overloads rejected.
- **B → roving, fixed:** `focus-delegation.strategy = roving` + `independent`, a fixed menu mechanic overriding the family `virtual` default. (Corrects the item's false "APG mandates roving" premise — APG permits both; WE *chooses* roving.)
- **C → one block, `shape` dimension:** `shape: menubar | menu | context` (default `menu`), orientation derived; not three blocks.
- **D → Selection under a `checkable` trait:** plain `menuitem` = command only; checkable items opt in (single→radio, multiple→checkbox).
- **E → Disclosure, not `hierarchy`:** submenu = parent `menuitem` + `aria-haspopup=menu` + Disclosure + a nested anchored Menu; the tree-select `hierarchy` intent is rejected (different paradigm).
- **F → the Menu block owns `separator`/`group`** directly.
- **G → #173 claims the menu-button trigger; the droplist roster entry is demoted** to trigger-only.

**Graduates to three spin-off builds** (composition order, `blockedBy` chain):
- **#299** — author the `command` intent (the one net-new dependency; realizes #016). Greenfield — prep first.
- **#300** — author the Menu block (composes #299 + existing intents), *blocked by #299*.
- **#301** — demote the droplist "Menu button" entry to trigger-only (Fork G), *blocked by #300*.

No single graduated entity — the ruling is captured here + in the research topic; the build is the three spin-offs.
