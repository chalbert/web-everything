---
bornAs: xxw8ri1
kind: story
size: 5
parent: "2508"
status: open
blockedBy: ["xgb0p8o"]
dateOpened: "2026-07-15"
tags: [plateau-loop, console, backlog-ui]
---

# Backlog-view: launch work on an item from the UI

Launch work on an item from the UI, on the write seam. Kick off building an agent-ready item — acquire a lane and start the build — from the console rather than invoking the loop by hand. It is the heaviest write action, so it lands last on a proven seam.

**Acceptance:** a Launch control on an agent-ready item starts work through the sanctioned lane / build entry point; the row reflects launching → in-flight; launching an ineligible (blocked / claimed) item is refused with the reason.

> **Gated on a semantics decision.** "Starts work" is undefined — there is no headless build entry point in the repo. What Launch *means* (claim + lane handoff vs a headless `claude -p` build vs enqueue) is an open fork in [Backlog-view Launch control — claim+handoff vs headless build vs enqueue](/backlog/xgb0p8o-backlog-view-launch-control-claim-handoff-vs-headless-build-/). The headless-build branch is itself downstream of the deferred agent-runner decision [#2444](/backlog/2444-plateau-loop-phase-1-agent-runner-shape-cli-spawn-contract-s/). Ratify the semantics fork before building; the acceptance's "in-flight" wording assumes the headless branch and will be re-worded to match whichever branch is chosen.
