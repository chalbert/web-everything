---
description: Print a concise work-in-progress table for this session — done, doing, next, table form.
---

Print a work-in-progress report for this session as a single markdown table. Output
**only** the table below, filled in — no preamble, no text before or after it, nothing
added or removed from its structure.

Always use exactly this format:

```
| Status | Item | Detail |
| --- | --- | --- |
| Done | <finished action> | <what happened, 1-2 sentences> |
| Doing | <thing in progress now> | <what's happening, 1-2 sentences> |
| ⚠ Needs you | <blocked item> | <what it's waiting on you for, 1-2 sentences> |
| Next | <planned step> | <what it is, 1-2 sentences> |
```

Rules:

- `Status` is one of `Done`, `Doing`, `Next`, or `⚠ Needs you` — use `⚠ Needs you` only
  for something that is stuck pending explicit human action (e.g. a parked PR awaiting
  operator review/merge, a decision only the operator can make). Not a catch-all for
  anything slow.
- One row per item. `Detail` is max ~1-2 sentences — no nested sub-bullets, no line
  breaks inside a cell.
- Pull only from this conversation's actual history, the active todo list, and a
  `ListAgents` call for live subagents — never invent or suggest new work.
- Done rows: finished actions only (files changed, decisions made, commands run) — not
  intentions or discussion.
- Doing rows: things actually in progress right now. Fold agent/subagent status in here
  (same judgment `status.md` uses for its AGENTS section) — call `ListAgents` to
  enumerate subagents this session spawned, and give each running one its own Doing row;
  flag it as `⚠ Needs you` instead if it's stuck (running far longer than the task should
  reasonably take, or no sign of progress since launch — judge from context, don't guess
  a fixed time limit) and there's nothing left for the agent itself to do about it. An
  open PR awaiting review, merge, or CI is a Doing row unless it's actually stuck, in
  which case it's `⚠ Needs you`.
- Next rows: only steps already planned/agreed in this session — not new suggestions or
  ideas you're generating now.
- If a status category has no rows, still include its header row in the table, with one
  row reading `<Status> | — | Nothing else planned.` (adjust the detail wording to fit
  the category, e.g. "Nothing done yet." for Done, "Nothing in progress." for Doing) —
  never omit a whole category. Omit the `⚠ Needs you` row entirely when nothing is
  blocked on the operator (unlike the other three, it has no empty-placeholder row).
- Don't re-run tools beyond the `ListAgents` check above, and don't re-derive information
  beyond what's already known in this session.
- No headers/sections/text beyond the single table. No tail checklist, no summary line
  after it.
