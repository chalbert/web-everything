---
kind: task
parent: "1855"
status: open
dateOpened: "2026-06-27"
tags: []
---

# Standard subagent return-hygiene contract — conclusions, not file-dumps or fabricated specifics

Spawned agents tend to return bloated lists, raw file dumps, and confidently-invented specifics (the first #1855 front-B sweep attached fabricated Claude Code version numbers). Author a short reusable preamble for agent prompts: return the conclusion the parent will keep, flag uncertainty explicitly, never fabricate version numbers or file:line refs, prefer a tight ranked list over prose. Wire it into the spawn patterns the batch + workflow skills use. Serves the subagent-return-hygiene metric of the model-usage watch (#1855).
