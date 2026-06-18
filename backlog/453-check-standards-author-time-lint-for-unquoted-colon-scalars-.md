---
type: issue
workItem: task
status: resolved
dateOpened: "2026-06-12"
dateStarted: "2026-06-13"
dateResolved: "2026-06-13"
tags: []
---

# check:standards author-time lint for unquoted-colon scalars in backlog frontmatter

The loader (#430) now skips malformed-YAML backlog items and warns, so a bad item degrades gracefully but slips past the gate unseen. Add a check:standards lint that flags the recurring trigger — an unquoted colon in a scalar frontmatter value (e.g. graduatedTo: we:a/b.json: foo) — at author time, so the fix is prompted in CI before the loader has to skip it.
