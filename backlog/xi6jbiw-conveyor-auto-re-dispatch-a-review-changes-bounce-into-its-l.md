---
kind: story
size: 5
parent: "2612"
status: open
scope: ["we:scripts/conveyor/", "we:skills-src/conveyor/"]
dateOpened: "2026-07-23"
tags: []
---

# Conveyor: auto-re-dispatch a review:changes bounce into its lane for repair

Today a `review:changes` bounce only parks (pr-watch exit 2); the delivery agent that built the PR has already exited (one agent = one item = one PR), so nothing repairs it — a human must take over via `/finish` or manually.

Wire the conveyor loop to detect a `review:changes` park on a conveyor-launched PR and auto-spawn a fix agent into that PR's lane: apply the reviewer's finding, get the gate green, re-push HEAD to the lane ref, and hand back for re-review. The fix agent never self-clears the human review label — it re-arms review and lets the human (or the AI-review convergence pass) re-verdict.

Include the manual take-over pattern proven this session, so the auto path and the human `/finish` path share one repair procedure.
