---
kind: story
size: 2
parent: "2612"
status: open
dateOpened: "2026-07-23"
tags: [plateau-loop, conveyor, backlog, cli]
---

# claim CLI: suppress the two-turn stop-here message for conveyor/background sessions

`claim` (in [`we:scripts/backlog.mjs`](../scripts/backlog.mjs)) prints an interactive **"⏸ stop here / let the chat be renamed"** two-turn message — it wants the human to end the turn so the session can be renamed to the claimed item before work continues. A **background delivery agent** obeying that instruction literally would **stall**: there is no human to end the turn, so the agent sits waiting for a hand-off that never comes.

**From the dry-run.** A conveyor delivery agent runs `claim` non-interactively as its first action. The two-turn stop message is written for a human-driven chat, not a background agent. The delivery brief now papers over it with a note ("ignore the stop-here message"), but relying on the agent to *disregard* a literal stop instruction is brittle — the robust fix is at the CLI.

**Fix — a CLI carve-out.** When `claim` runs under a conveyor/background session, **suppress or reword** the two-turn stop message. Detect that context deterministically:
- `--session=conveyor-*` (the conveyor's session-slug convention), or
- an explicit `--background` flag the delivery agent passes.

In that mode, either omit the stop message entirely or replace it with a one-line "claimed (background session — no stop)" so the agent proceeds in the same turn. Interactive human sessions keep the current two-turn behaviour unchanged.

Refs the conveyor delivery brief ([#2613](/backlog/2613-the-conveyor-skill-command/)).
