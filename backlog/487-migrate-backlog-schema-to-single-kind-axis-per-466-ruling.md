---
type: issue
workItem: story
size: 5
status: open
blockedBy: ["466"]
dateOpened: "2026-06-13"
tags: []
---

# Migrate backlog schema to single kind axis (per #466 ruling)

Execute the #466 ruling: collapse type + workItem into one fresh kind field (story|epic|task|decision), dropping both old fields. One-pass rewrite of every backlog/*.md frontmatter, plus the tooling that reads them — loader tiering (backlog.js:206-209), validator enum/sizing/fork-lint (check-standards-rules.mjs:21,120,139-148,219-237 — also drop the dead review enum), scaffold flags + emit (scaffold.mjs:42-44, backlog.mjs:156), render badges + typeOrder (backlog.njk, backlog-pages.njk), and the normative enum + agile-sizing table in docs/agent/backlog-workflow.md. fix-vs-feature becomes an optional tag, not a field. Gate: check:standards green after the rewrite.
