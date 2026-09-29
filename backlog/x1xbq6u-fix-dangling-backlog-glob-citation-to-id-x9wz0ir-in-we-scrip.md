---
kind: task
parent: "4075"
status: open
dateOpened: "2026-09-29"
tags: []
---

# Fix dangling backlog-glob citation to id x9wz0ir in we:scripts/conveyor/reconcile-core.mjs

The #4318 dangling-backlog-glob-citation guard (gate 6f-ii-d) found a live instance beyond its own enumerated fix set: we:scripts/conveyor/reconcile-core.mjs cites the glob form naming id x9wz0ir in a comment (the 2026-09-25 ci-red/DIRTY incident writeup), and that id resolves to no currently-tracked or landed backlog item (no file, no bornAs match) - likely an abandoned/never-committed lane scaffold. Read the incident's real backing card (if any still exists) and re-point the citation to it, or drop the dangling id and describe the incident in prose instead. One-line fix, single file.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
