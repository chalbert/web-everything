---
type: issue
workItem: story
size: 3
parent: "192"
status: open
blockedBy: ["476"]
dateOpened: "2026-06-13"
tags: []
---

# Research-freshness history: refresh-as-new-report + bidirectional supersedes render

Slice C of the research-freshness ruling (#441), blocked by #476. Implement refresh = a new dated reports/YYYY-MM-DD-{slug}.md (never in-place overwrite); the topic surfaces the latest as canonical and links superseded revisions via the bidirectional supersedes/supersededBy pointer + superseded status. Render prior revisions as history on the topic page (src/research-topic-pages.njk). Preserves the immutable dated audit trail #192 names.
