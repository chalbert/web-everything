# Menu / menubar / context-menu — prior-art survey

**Date**: 2026-06-11
**Point**: Web-platform and library prior art for a Web Everything **Menu block** (the ARIA `menu`/`menubar`/`menu-button`/context-menu family — *action invocation*, not value selection), grounding backlog #173's open forks and surfacing what the item got factually wrong (it claims menus mandate roving tabindex — APG permits both) and what it omitted (separator/group semantics; the menu-button double-home in the droplist roster; the native `command`/`commandfor` invocation substrate as the action mechanism).
**Backlog item**: `/backlog/173-menu-menubar-block/`
**Research page**: `/research/menu-menubar-context-menu/`
---

## Question

A Menu block is named as a harvest candidate but no design exists. Before authoring it, survey prior art per [design-first.md](../docs/agent/design-first.md) step 1, so the trait selections for the three shapes, focus model, checkable items, submenus, and command invocation reuse platform vocabulary instead of coining terms — and so the menu vs. value-selection boundary is drawn correctly.

## Recommendation (to ratify in #173)

1. **Fork A — command invocation is the NEW `command` intent (#016), not the Action Intent.** A menu item *invokes an action* — the declarative surface of the `command` intent #016 resolved into existence (grounded on the now-Baseline `command`/`commandfor` + `CommandEvent`). The existing **Action Intent** is about *visual weight* (`primary`/`destructive`) and stays orthogonal. **Default: each menu item composes `command`; checkable items additionally compose Selection (Fork D).** This is the one net-new dependency — sequence #016 before/with #173.
2. **Fork B — roving focus is the menu default, as a fixed member trait, not a family law.** The item's premise is *factually wrong*: APG permits **either** roving tabindex **or** `aria-activedescendant` for menus. WE *chooses* roving (the GUI-menu convention Radix/Headless/MUI/Fluent all ship), overriding the droplist family's `virtual` default, as a **fixed mechanic**. **Default: `focus-delegation.strategy = roving`, `selectionFollowsFocus = independent`, fixed.**
3. **Fork C — one Menu block with a `shape` dimension, not three blocks.** Menubar, popup menu, and context menu share the entire item/role/keyboard machinery; they differ only in summoning and orientation. **Default: one block, `shape: menubar | menu | context`, `orientation` derived from shape (`menu`/`context` → vertical, `menubar` → horizontal/both).**
4. **Fork D — checkable items reuse Selection, gated to a `checkable` trait.** `menuitemcheckbox`/`menuitemradio` are genuine `aria-checked` state. **Default: plain `menuitem` = `command` only; checkable items opt in via a `checkable` trait composing Selection (`single`→radio group, `multiple`→checkboxes).**
5. **Fork E — submenu nesting reuses Disclosure, NOT the tree-select `hierarchy` intent.** A submenu is a *transient cascading popup* (Right opens a fresh anchored surface, Left closes), not a *navigable data hierarchy* (no flatten-to-visible-rows, no `aria-level/setsize/posinset`). **Default: submenu = parent `menuitem` with `aria-haspopup=menu` + Disclosure (`aria-expanded`) + a nested anchored Menu surface; no `hierarchy` composition.**
6. **Fork F (item omitted) — separator & group semantics.** `role=separator` and `role=group` (labelled section) are first-class APG menu roles every library ships. **Default: the Menu block owns them directly; the labelled-group case may lean on Selection's existing `grouping` dimension.**
7. **Fork G (item didn't notice) — "Menu button" is mis-filed in the droplist family.** `blocks.json:21,36` lists "Menu button" as a droplist (listbox/combobox value-selector) member, but a true menu button opens a `role=menu` of *commands*. **Default: #173 claims the menu-button trigger; remove/demote the droplist "Menu button" entry to "trigger shape only, surface owned by the Menu block."**

## Key findings

### 1. WAI-ARIA APG — menu/menubar, menu-button, context menu

**Roles** ([APG Menu & Menubar](https://www.w3.org/WAI/ARIA/apg/patterns/menubar/)): `menubar`, `menu`, `menuitem` (action), `menuitemcheckbox` (`aria-checked`), `menuitemradio` (mutually-exclusive within a `group`), `group` (labelled section), `separator` (non-focusable). Disabled items stay **focusable but non-activatable** (`aria-disabled`).

**Keyboard model** (reuse verbatim): Down/Up move within a menu (in a menubar, Down opens the submenu); Right/Left move between menubar items, and inside a menu Right opens a submenu / Left closes it and returns to the parent item; Enter activates or opens; Space toggles a checkable item; Escape closes and **returns focus to the invoker**; Home/End jump; Tab/Shift+Tab move focus out and **close all menus**; printable chars type-ahead.

**Focus model — the item's claim is WRONG.** APG mandates neither technique. Quote: *"The menu container has `tabindex` set to `-1` or `0` and `aria-activedescendant` set to the ID of the focused item. Each item… has `tabindex` set to `-1`, except in a menubar, where the first item has `tabindex` set to `0`."* So APG presents **roving tabindex *or* `aria-activedescendant`** ([APG Menubar](https://www.w3.org/WAI/ARIA/apg/patterns/menubar/); generic two-technique guidance in [Developing a Keyboard Interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/), with no menu-specific preference). Roving is a *library/GUI* convention, not an APG requirement.

**Menu button** ([APG](https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/)): a `role=button` trigger with `aria-haspopup="menu"` + `aria-expanded`; Enter/Space/Down open to the first item, Up opens to the last.

**Three shapes** share the identical item/role/keyboard machinery (menubar adds `tabindex=0` on its first item; context menu also summons via **Shift+F10**/context key) — confirming Fork C.

### 2. Native platform substrate (status ~June 2026)

- **`<menu>` element** is purely a **semantic alias for `<ul>`** (implicit role `list`, no menu role, no keyboard) — [MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/menu): *"treated by browsers… no different than `<ul>`."* The early context-menu use is **removed from the spec**.
- **Context-menu `type="context"` / `contextmenu` attribute** is **dead** — dropped ~Feb 2017, implemented by no browser ([caniuse](https://caniuse.com/menu); [w3c/html#589](https://github.com/w3c/html/issues/589)). A WE context menu listens for `contextmenu` and renders an ARIA `role=menu`.
- **Popover API** provides the floating-surface substrate (top-layer, light-dismiss) — Baseline; the Anchor intent composes it.
- **Invoker Commands API** (`command`/`commandfor` + `CommandEvent`) is **newly Baseline** (Chrome 135, Firefox 144, Safari 26.2 — "Baseline 2025, newly available since Dec 2025"; [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Invoker_Commands_API), [InfoQ Jan 2026](https://www.infoq.com/news/2026/01/html-invoker-commands/)). Built-ins cover popover/dialog; **custom commands** use a `--`-prefixed value and dispatch `CommandEvent` (`.command`, `.source`). **There is no built-in menu command** — a menu item's action is a *custom* command. This is the native substrate for the `command` intent (Fork A), the same one #016 grounded on.

**Net:** a WE menu is **ARIA-composed** (roles + keyboard hand-rolled), with native help only at two seams — Popover (surface) and Invoker Commands (action dispatch). `<menu>` and `type="context"` contribute nothing.

### 3. Benchmark libraries — unanimous: Menu ≠ Select

Every surveyed library models **menu (action invocation) as a separate component from listbox/select (value selection)**: **Radix** (`DropdownMenu`/`ContextMenu`/`Menubar`, roving tabindex, `CheckboxItem`/`RadioItem`), **Headless UI** (`Menu` distinct from `Listbox`: *"Menu… dropdown menus; Listbox tracks a selected value"*), **MUI** (`MenuItem onClick` vs `Select` value), **Fluent v9** (`MenuItemCheckbox`/`MenuItemRadio` first-class), **Carbon** (*"implements the APG menu pattern"*, `menuitemcheckbox`/`menuitemradio`), **Ant** (`Dropdown`/`Menu` "execute the action" vs `Select` returns a value), **Shoelace** (`sl-menu` separate from form selects, the one library that blurs the line by emitting `sl-select`).

**Divergences:** the headless leaders (Radix) use **roving** (confirms Fork B); Fluent/Carbon/Radix/Shoelace make checkbox/radio items first-class while Headless/MUI/Ant leave checked-state to the author (Fork D's first-class camp wins); on packaging, Radix ships three components while Carbon/Ant parameterize one Menu by trigger — the platform's shared role machinery favors **one-block-with-shape** (Fork C).

### 4. Cross-cutting paradigms a menu COMPOSES

| Paradigm | Reuse which WE intent | Net-new? |
| --- | --- | --- |
| Anchored surface / edge-aware placement / dismissal & focus return | **Anchor Intent** (`type=menu`, [intents.json:1197](../src/_data/intents.json#L1197)) | No |
| Focus delegation (roving, one active item) | **Focus Delegation** ([intents.json:54](../src/_data/intents.json#L54)) — override family default to `roving` | No |
| Type-ahead seek | **Type-Ahead** ([intents.json:1432](../src/_data/intents.json#L1432)) | No |
| Selection (checkable items) | **Selection** ([intents.json:1059](../src/_data/intents.json#L1059)), under a `checkable` trait | No |
| Submenu open/closed state | **Disclosure** ([intents.json:1809](../src/_data/intents.json#L1809)) | No |
| **Command invocation (the action)** | **`command` intent** (#016 — not yet built) | **Yes — the one net-new dependency** |
| Separator / group sectioning | Menu block owns directly (group label overlaps Selection `grouping`) | Partly (Fork F) |
| Action prominence (`destructive`) | **Action Intent** ([intents.json:854](../src/_data/intents.json#L854)) — orthogonal to command | No |

The single net-new dependency is the `command` intent (#016); everything else the constellation already owns. The menu block is a thin composition manifest, as the item anticipated.

## Files Created/Modified

| File | Action |
| --- | --- |
| `reports/2026-06-11-menu-menubar-block.md` | Created (this report) |
| `src/_data/researchTopics.json` | Added `menu-menubar-context-menu` topic |
| `src/_includes/research-descriptions/menu-menubar-context-menu.njk` | Created (research write-up) |
| `backlog/173-menu-menubar-block.md` | Reshaped to the prepared-fork shape |
