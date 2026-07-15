---
bornAs: xxw8ri1
kind: story
size: 5
parent: "2508"
status: open
blockedBy: ["2514"]
dateOpened: "2026-07-15"
tags: [plateau-loop, console, backlog-ui]
---

# Backlog-view: launch work on an item from the UI

Launch work on an item from the UI, on the write seam. Kick off building an agent-ready item — acquire a lane and start the build — from the console rather than invoking the loop by hand. It is the heaviest write action, so it lands last on a proven seam.

**Acceptance:** a Launch control on an agent-ready item starts work through the sanctioned lane / build entry point; the row reflects launching → in-flight; launching an ineligible (blocked / claimed) item is refused with the reason.
