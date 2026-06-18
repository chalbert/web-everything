---
type: idea
workItem: story
size: 5
status: resolved
dateOpened: "2026-06-11"
dateStarted: "2026-06-11"
dateResolved: "2026-06-11"
graduatedTo: "intent:command"
tags: []
---

# Author the command intent (action invocation)

Author the command intent — the declarative UX surface for invoking actions (which commands exist, their keybindings, command-palette behaviour), grounded on the Baseline Invoker Commands API (command/commandfor + CommandEvent). Realizes the #016 ruling (it is an intent, not a webcommands project; Mousetrap and other keybinding engines are adapters). The net-new dependency the Menu block (#173) composes. Greenfield — run a prep pass (keybinding + palette prior art) before authoring.

## Delivery (2026-06-11)
**Prep pass:** the prior art was already surveyed in
`we:reports/2026-06-11-menu-menubar-block.md` (Fork A) — no new survey needed, and **no
design fork surfaced**. The boundary is settled: the existing **Action Intent** owns
visual weight (`destructive`) and stays orthogonal; this new **`command`** intent
owns *invocation*, grounded on the now-Baseline **Invoker Commands API**
(`command`/`commandfor` + `CommandEvent`; app commands use a `--`-prefixed value).
Keybinding engines (Mousetrap, tinykeys) are **adapters**, never the baseline (#016).

Authored the **`command`** intent (`status: draft`) in `we:src/_data/intents.json`
(single-entry splice; renders at `/intents/command/`, verified via `build:check`):

- **Dimensions** (UX-only, defaults in prose): `binding` (`none` default · `chord` ·
  `sequence`), `scope` (`contextual` default · `global` opt-in — global claims an
  app-wide shortcut so it's never the default), `discoverability` (`listed` default ·
  `hidden` — palette presence; most-permissive default).
- `requiresCapabilities: ["invokers"]`; `events: ["command"]` (the `CommandEvent`).
- **Composition**: the net-new dependency the Menu family (#173) composes (each
  `menuitem` invokes a command); a toggle command composes Selection/Disclosure for
  its state; visual weight composes Action; palette is a surface listing `listed`
  commands. `we:AGENTS.md` inventory regenerated (+1 intent).
