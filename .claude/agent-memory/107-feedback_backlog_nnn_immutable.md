---
name: feedback_backlog_nnn_immutable
description: Backlog NNN ids are immutable — never rename/renumber an existing backlog item
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 43f39c1a-cc6a-4f2c-860d-d64a6835fcf8
---

Never rename or renumber an existing `backlog/<NNN>-<slug>.md` file's `NNN`. The number is the item's id for life; only the slug may be reworded (via `formerSlugs:` redirects).

**Why:** Renumbering silently breaks every `#NNN` short-ref and `/backlog/<NNN>/` URL, and under concurrent agents (multiple sessions work this backlog at once) it cascades into id collisions — sessions chasing the same next-number renumber each other's work. Hit live on 2026-06-06: a concurrent agent renumbered an item 117→119 mid-task, colliding with files being restored.

**How to apply:** New item = highest `NNN` + 1 or a never-used gap; re-check `ls backlog/` right before writing and, on a collision, the *newer* item yields to the next free number — never touch a number already on disk. Codified in [docs/agent/backlog-workflow.md](docs/agent/backlog-workflow.md) (*Adding an item*, *Renaming an item*, *Rules*) and the [[feedback_backlog_is_tracker]] skill. Relates to [[feedback_no_commit_talk_in_backlog]].
