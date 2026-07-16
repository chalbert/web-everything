---
bornAs: xxw8ri1
kind: story
size: 5
parent: "xk0eti5"
status: open
blockedBy: ["xr1vhog"]
dateOpened: "2026-07-15"
tags: [plateau-loop, console, backlog-ui]
---

# Backlog-view: launch work on an item from the UI

Launch work on an item from the UI, on the write seam. Kick off building an agent-ready item — acquire a lane and start the build — from the console rather than invoking the loop by hand. It is the heaviest write action, so it lands last on a proven seam.

**Acceptance:** a Launch control on an agent-ready item starts work through the sanctioned lane / build entry point; the row reflects launching → in-flight; launching an ineligible (blocked / claimed) item is refused with the reason.

> **Resolved into the build-queue program.** #2525 ratified the **build** semantics (a real headless build), so this is now the console's **build-now / add-to-queue control** under the [autonomous AI build queue](/backlog/xk0eti5-plateau-loop-autonomous-ai-build-queue/) program — no longer a standalone "launch" fork. It rides on the build endpoint + supervised builder (`we:backlog/xr1vhog-build-endpoint-supervised-builder-post-api-backlog-build-dra.md`, this item's `blockedBy`), which in turn needs the runner (#2444). The row reflects the real in-flight → PR the endpoint drives, and eligibility uses the queue's hard readiness gate.
