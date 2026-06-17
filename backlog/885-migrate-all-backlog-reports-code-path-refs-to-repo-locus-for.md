---
type: issue
workItem: story
size: 5
parent: "880"
status: open
blockedBy: ["884"]
dateOpened: "2026-06-17"
tags: []
---

# Migrate all backlog + reports code-path refs to repo-locus form; flip the gate to error

One-time bulk rewrite of every code-path reference across backlog/*.md (867) + reports/*.md (150) to the <repo>: locus form via regex + locus inference: a path that resolves in WE's tree gets we:, else resolve against the frontierui / plateau-app trees. Log paths ambiguous across two repos for a manual disambiguation pass rather than guessing. Then flip the #884 detection check from warn to error so check:standards stays green only on the migrated corpus. Finishes #841. Slice C of #880, blocked by the #884 gate it must satisfy.
