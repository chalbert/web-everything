---
bornAs: xv46vdw
kind: story
size: 3
parent: "2508"
status: open
blockedBy: ["2514"]
dateOpened: "2026-07-15"
tags: [plateau-loop, console, backlog-ui]
---

# Backlog-view: change an item's priority from the UI

Change an item's priority from the UI, on the write seam. Set or clear an item's priority (e.g. `low`) so a reader can reprioritise without dropping to the CLI — the same field the readiness / batch machinery reads when it ranks work.

**Acceptance:** a priority control writes the frontmatter via the lane-gated path; the row reflects the new priority; clearing it returns the item to the default.
