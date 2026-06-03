---
type: decision
status: open
dateOpened: "2026-05-31"
tags: [gap-analysis, project, intent, commands, keybindings]
---

# Decide on Commands/Keybindings project — `webcommands` (gap #9)

Keyboard shortcuts + command palette. The Mousetrap adapter is already hinted at in `webadapters`, and the platform is adding the `command`/`commandfor` attributes and `CommandEvent`. Could be a project or a `command` intent.

## Triage context

- **Kind**: Project and/or Intent
- **Native anchor**: `keydown`, `CommandEvent`/`command` attr, Mousetrap adapter
- **Native-first**: ◆ medium · **Gap**: ▽ low · **Effort**: ◆ medium
- **Rank**: 9

## Open call

Project vs `command` intent — and the relationship to the already-hinted Mousetrap adapter under `webadapters`.
