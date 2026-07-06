---
kind: story
size: 3
status: open
dateOpened: "2026-07-06"
tags: []
---

# Block primary-cwd backlog mutations (claim/resolve/scaffold) and steer them to a lane

we:scripts/guard-lane.mjs enforces the lane-only invariant (#104/#2183) for the Edit/Write tools, but a Bash call to we:scripts/backlog.mjs (claim|resolve|scaffold) run with the PRIMARY checkout as cwd mutates a backlog item on primary and slips past every guard (found while working #2095: claim stamped open→active on primary; reverted and re-run in the lane). Add a we:scripts/guard-bash.mjs rule denying a backlog-mutation subcommand when cwd is a primary checkout rather than a lane clone, steering the user to the lane — closing the same hole guard-lane closes for Edit/Write. Relates to #2219 (claim/resolve vs lane isolation).
