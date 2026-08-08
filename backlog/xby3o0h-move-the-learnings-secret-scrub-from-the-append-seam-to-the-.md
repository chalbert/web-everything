---
kind: story
size: 3
status: open
dateOpened: "2026-08-08"
tags: []
---

# Move the learnings secret-scrub from the append seam to the publish seam

Fork 3 of #2978 removes the pool entry caps and the reject-absolute-paths rule, which are what currently forecloses secret/code leak classes. The pool is untracked machine-local state, but harvest OUTPUT becomes backlog items and agent-memory files that are committed and pushed — so the scan belongs at the exit, not the entrance. Move the entropy/secret/charclass checks out of validateEntry (we:scripts/conveyor/learnings-drop.mjs) and run them on what the harvest is about to write.
