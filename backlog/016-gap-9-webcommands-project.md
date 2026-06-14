---
type: decision
workItem: story
size: 3
status: resolved
dateOpened: "2026-05-31"
dateResolved: "2026-06-11"
graduatedTo: none
tags: [gap-analysis, project, intent, commands, keybindings]
---

# Decide on Commands/Keybindings project — `webcommands` (gap #9)

Keyboard shortcuts + command palette. The Mousetrap adapter is already hinted at in `webadapters`, and the platform is adding the `command`/`commandfor` attributes and `CommandEvent`. Could be a project or a `command` intent.

## Triage context

- **Kind**: Project and/or Intent
- **Native grounding**: `keydown`, `CommandEvent`/`command` attr, Mousetrap adapter
- **Native-first**: ◆ medium · **Gap**: ▽ low · **Effort**: ◆ medium
- **Rank**: 9

## Open call

Project vs `command` intent — and the relationship to the already-hinted Mousetrap adapter under `webadapters`.

## Resolution (2026-06-11)
**Intent `command`, not a project — settled by the per-fork classification pass.** Keyboard handling is vendor-independent: there is **no multi-vendor interop / engine-swap story**, so it is **not a Protocol** and not a project (Q2). The UX "what" — *which commands exist, their keybindings, command-palette behaviour* — is the declarative surface of an **Intent** (`command`), grounded on the platform's `command`/`commandfor` attributes + `CommandEvent` (native-first). **Mousetrap (and any keybinding engine) is an adapter** under `webadapters` — the optional opt-in, never the baseline. So the gap resolves to a `command` intent + an adapter slot, not a `webcommands` project. Authoring the intent (greenfield: command vocabulary, keybinding dimension, palette UX) is a separate prep pass + build — note the overlap with the menu block (#173), which *invokes* commands.
