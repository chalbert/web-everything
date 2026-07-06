---
kind: story
size: 3
status: open
dateOpened: "2026-07-06"
tags: []
---

# Block primary-cwd backlog mutations (claim/resolve/scaffold) and steer them to a lane

The lane-only invariant (#104/#2183) is enforced for the Edit/Write tools by we:scripts/guard-lane.mjs, but a Bash call to we:scripts/backlog.mjs (claim|resolve|scaffold) run with the PRIMARY checkout as cwd mutates a backlog item on primary and slips past every guard (observed while working #2095: claiming stamped open to active on primary; it had to be reverted and re-run inside the lane clone). Add a rule to we:scripts/guard-bash.mjs that denies a we:scripts/backlog.mjs mutation subcommand when cwd is a constellation primary checkout rather than a lane clone, pointing the user to run it from the lane — closing the same lane-isolation hole that guard closes for Edit/Write. Relates to #2219 (claim/resolve lifecycle vs lane isolation).
