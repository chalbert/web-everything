---
name: wip-report-format-short-plain-phone-friendly
description: The `/wip` report is short and read on a phone — one plain-words description per item, wrap never ellipsis; after Needs you comes RUNNING (with agents), QUEUE (no agents), then NEXT-not-queued from the Priority order; fix the script, never hand-edit its output.
metadata:
  type: feedback
---

The `/wip` report format is set by the operator (2026-09-21), who reads it on a phone.

**Why:** the older report was a long table with a Done-since section and internal findings. It did not fit a phone screen, and truncated cells hid what each item was.

**How to apply:**
- Keep it short.
- Give each work item one description, in plain words.
- Wrap long lines. Never truncate with an ellipsis.
- **Needs you** comes first. After it, three parts (operator's LAYOUT line, which replaces the earlier "Needs you, then running, then next"; the brevity and no-ellipsis rules still apply):
  - (a) **RUNNING**: a compact table with ID, description, supervisor agent, and its tasks with the agent on each task.
  - (b) **QUEUE**: an ordered list of the same rows (ID, description, tasks) with NO agent column, because the queue is routed mechanically.
  - (c) **NEXT, not yet queued**: a similar table (ID, description, planned tasks, its Priority-order line) for the operator to review and approve into the queue. The lines come from the Priority order; see [[next-items-come-from-prototype-tracker-priority-order]].
- No long Done-since table and no internal findings.
- Fix the script, never hand-edit its output. The script is `scripts/operations/wip-report-cli.mjs` (prototype branch). Print the script's output verbatim.
- "Needs you" is the operator-queue script's NEEDS YOU section verbatim and nothing else. See [[feedback-needs-you-only-when-truly-ready]].

Part of the operator's standing rules: [[operator-standing-rules-live-in-a-file-handoff-never-overwrites]] (rules 4 and 5).
