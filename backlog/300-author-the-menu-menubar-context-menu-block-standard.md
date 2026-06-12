---
type: idea
workItem: story
size: 8
status: resolved
blockedBy: ["299"]
dateOpened: "2026-06-11"
dateStarted: "2026-06-12"
dateResolved: "2026-06-12"
graduatedTo: block:menu
tags: []
---

# Author the menu / menubar / context-menu block standard

Author the Menu block — a composition manifest for action invocation (not value selection), per the ratified #173 forks: one block with a shape:menubar|menu|context dimension; roving focus (fixed, overriding the droplist family virtual default); checkable items reusing Selection under a checkable trait; submenus composing Disclosure (not the tree-select hierarchy intent); separator/group owned directly. Composes the new command intent (#299) + Anchor/Focus-Delegation/Type-Ahead/Selection/Disclosure/Action. Grounded in the /research/menu-menubar-context-menu/ survey.

## Progress

**Status:** resolved 2026-06-12 → `block:menu`.

Authored the **Menu block** as a composition manifest (modeled on the droplist family page), per design-first "Adding a block":

- `src/_data/blocks.json` — new `menu` entry: `implementsIntent: command`, `composesIntents: [command, focus-delegation, anchor, type-ahead, selection, disclosure, action]`, and the seven ratified #173 forks captured verbatim as `designDecisions`.
- `src/_includes/block-descriptions/menu.njk` — the canonical page (contracts only): menu-vs-select distinction, the `shape: menubar|menu|context` table, composed-intents table, item-role/trait-surface map, "why a submenu is not a tree", keyboard contract, Web Standards Alignment (APG / Invoker Commands / Popover+Anchor / contextmenu), and Framework Research (Radix/Headless/MUI/Fluent/Carbon/Ant/Shoelace).

Faithful to all seven forks: command-invocation home (A), roving-fixed focus (B), one block + shape dimension (C), checkable via Selection `checkable` trait (D), submenu = Disclosure+Anchor not hierarchy (E), block owns separator/group (F), claims the menu-button trigger (G). No new glossary terms — menu/menuitem/separator/group are established ARIA roles, reused not redefined.

Renders live at `/blocks/menu/`. Follow-on: demote the droplist "Menu button" roster entry to trigger-only (#301).
