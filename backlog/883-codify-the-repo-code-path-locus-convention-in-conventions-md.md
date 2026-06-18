---
type: issue
workItem: story
size: 2
parent: "880"
status: resolved
dateOpened: "2026-06-17"
dateStarted: "2026-06-18"
dateResolved: "2026-06-18"
graduatedTo: docs/agent/conventions.md
tags: []
---

# Codify the <repo>: code-path locus convention in we:conventions.md

Add the repo-locus rule to we:docs/agent/conventions.md: every code-path reference in backlog/reports carries a <repo>: prefix — aliases we:/fui:/plateau: (full names accepted), in-repo links keep a clickable relative target ([we:path](path)), cross-repo paths are plain text with the prefix. Ratifies the two bold-defaulted knobs from #880 (alias-vs-full-name: allow both, default alias; rollout: one-pass). Adds an authoring note to we:docs/agent/backlog-workflow.md so new items comply from creation. Slice A of #880 — the rule the #884 gate enforces.

## Progress

- Added the **Repo-locus code-path references** section to `we:docs/agent/conventions.md` (the convention text,
  alias table with `we:`/`fui:`/`plateau:` defaults, and the carve-outs: fenced code, npm specifiers, URLs,
  WE-relative frontmatter fields). Both #880 knobs ratified: allow-both/default-alias and one-pass rollout
  (noted as #885's hard cutover).
- Added the authoring note to `we:docs/agent/backlog-workflow.md` (Authoring an item) so new items comply from
  creation, pointing at the we:conventions.md rule.
