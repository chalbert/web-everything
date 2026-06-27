---
kind: task
parent: "1855"
status: resolved
dateOpened: "2026-06-27"
dateStarted: "2026-06-27"
dateResolved: "2026-06-27"
tags: []
---

# Standard subagent return-hygiene contract — conclusions, not file-dumps or fabricated specifics

Spawned agents tend to return bloated lists, raw file dumps, and confidently-invented specifics (the first #1855 front-B sweep attached fabricated Claude Code version numbers). Author a short reusable preamble for agent prompts: return the conclusion the parent will keep, flag uncertainty explicitly, never fabricate version numbers or file:line refs, prefer a tight ranked list over prose. Wire it into the spawn patterns the batch + workflow skills use. Serves the subagent-return-hygiene metric of the model-usage watch (#1855).

## Shipped (batch-2026-06-27-1842-1720)

A single return-hygiene contract — *return the conclusion the parent keeps, not a transcript; never fabricate
specifics; flag uncertainty; ranked list over prose; ground every structured field* — wired into **both**
spawn paths the skills use:
- **Parallel `/workflow`** — a `RETURN_HYGIENE` constant in `we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js`,
  prepended to all four `agent()` spawn prompts (probe, item-worktree, serial-lane, replay). The script has no
  runtime filesystem read, so the contract lives inline as a constant.
- **Serial `/batch` (Opus→Sonnet delegation)** — codified in `we:docs/agent/backlog-workflow.md` under
  *Model routing* (the doc every serial-loop `Agent(model:"sonnet")` spawn follows), as the floor that makes
  the section's existing "returns a summary, not file dumps" enforceable. The two are kept in sync by note.
