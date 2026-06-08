---
type: idea
workItem: story
size: 5
status: open
dateOpened: "2026-06-07"
tags: [block, menu, menubar, context-menu, command, aria, candidate, harvest]
relatedProject: webblocks
---

# Menu / menubar / context-menu block (action commands, not value selection)

A first-class **Menu block** for invoking *commands* — the ARIA `menu`/`menubar`/`menuitem` pattern — distinct from the existing Dropdown/Droplist, which are value **selects** (combobox/listbox). A menu's items *do something* (run an action, open a submenu) rather than commit a value; that difference drives different focus, selection, and keyboard semantics, so it warrants its own composition.

The constellation already owns every paradigm a menu needs; what's missing is the block that ties them together — exactly as Dropdown composes them for selection:

- **Focus Delegation Intent** — `roving` strategy, `both` orientation for a menubar, `independent` selection (focus moves without activating; Enter/Space invokes).
- **Selection Intent** — only for checkable/radio menu items (`menuitemcheckbox` / `menuitemradio`).
- **Anchor Intent** — positions a popup/context menu surface against its trigger or the pointer.
- **Surface Intent** — elevation/material of the floating menu surface.

## Scope to design (via [design-first.md](../docs/agent/design-first.md) / [new-standard](../.claude/skills/new-standard/SKILL.md))

- The three shapes — inline **menubar**, trigger-opened **menu** (popup), and **context menu** (pointer-anchored) — as one contract with a variant axis.
- Native-first substrate: `<menu>`/`popover`/Invoker Commands API where available; ARIA fallback otherwise. Confirm current baseline.
- Submenus, separators, grouping, disabled items, type-ahead (composes Type-Ahead Intent).
- Relationship to the Action Intent (each item is an action) and Keyboard Shortcuts block (a menu item may advertise its accelerator).

> **Provenance:** surfaced during a final review of the legacy `plateau` repo, which had only an empty `menu.md` stub. **Plateau is not a model and must not be consulted or copied** — build this fresh from the intents above.
