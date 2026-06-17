---
type: issue
workItem: story
size: 2
parent: "880"
status: open
dateOpened: "2026-06-17"
tags: []
---

# Codify the <repo>: code-path locus convention in conventions.md

Add the repo-locus rule to docs/agent/conventions.md: every code-path reference in backlog/reports carries a <repo>: prefix — aliases we:/fui:/plateau: (full names accepted), in-repo links keep a clickable relative target ([we:path](path)), cross-repo paths are plain text with the prefix. Ratifies the two bold-defaulted knobs from #880 (alias-vs-full-name: allow both, default alias; rollout: one-pass). Adds an authoring note to docs/agent/backlog-workflow.md so new items comply from creation. Slice A of #880 — the rule the #884 gate enforces.
