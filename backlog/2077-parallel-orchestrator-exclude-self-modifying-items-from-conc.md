---
kind: story
size: 5
status: open
dateOpened: "2026-07-01"
tags: []
---

# Parallel orchestrator: exclude self-modifying items from concurrent lanes (or move lane tooling to an editable locus)

First multi-lane run (batch-2026-07-01-1947-2071): #2071/#2072/#2073 all edit the live we:.claude/skills/batch-backlog-items/parallel-execute.workflow.js — the file the Workflow tool is executing — so the sandbox locks it and their lanes thrash and cannot land; they carried and one wedged the run (forced TaskStop). Fix EITHER (a) pack/probe flags any item whose touch-set includes the live workflow/skill files and forces it onto a serial /batch, OR (b) move the lane/orchestrator tooling to a locus the run does not execute from so mid-run edits land. Prefer (a) cheap guard + (b) real fix. Sibling to we:#2072.
