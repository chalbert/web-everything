---
type: issue
workItem: story
size: 1
status: open
dateOpened: "2026-06-16"
tags: []
---

# firstParagraph mis-skips a #NNN-leading digest paragraph as a heading (lost summary)

The src/_data/backlog.js firstParagraph() helper skips any line matching /^#/ as a markdown heading, but a #NNN cross-reference is not a heading (an ATX heading needs '# ' — hash plus space). A scaffolded item whose digest opens with "#719 …" loses its whole lead paragraph, so summary comes out empty and check:standards errors "missing required field summary" (hit on #743 during batch-2026-06-15). Fix: skip only a real heading (/^#{1,6}\s/) instead of /^#/; add a test that a #NNN-leading paragraph keeps its summary.
