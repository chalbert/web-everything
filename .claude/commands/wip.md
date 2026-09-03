---
description: Print a concise work-in-progress table for this session — done, doing, next, table form.
---

Print a work-in-progress report for this session as separate markdown tables, one per
category. Output **only** the sections below, filled in — no preamble, no text before
or after them, nothing added or removed from their structure.

Always use exactly this format:

```
## Done
| Item | Detail |
| --- | --- |
| <finished action> | <what happened, 1-2 sentences> |

## Doing
| Item | Detail |
| --- | --- |
| <thing in progress now> | <what's happening, 1-2 sentences> |

## Next
| Item | Detail |
| --- | --- |
| <planned step> | <what it is, 1-2 sentences> |
```

Only when something is genuinely blocked pending explicit human action, append this
fourth section (heading + table) after Next:

```
## ⚠ Needs you
| Item | Detail |
| --- | --- |
| <blocked item> | <what it's waiting on you for, 1-2 sentences> |
```

Rules:

- Four possible sections: `Done`, `Doing`, `Next`, and the optional `⚠ Needs you`. Use
  `⚠ Needs you` only for something that is stuck pending explicit human action (e.g. a
  parked PR awaiting operator review/merge, a decision only the operator can make). Not
  a catch-all for anything slow.
- One row per item. `Detail` is max ~1-2 sentences — no nested sub-bullets, no line
  breaks inside a cell.
- Pull only from this conversation's actual history, the active todo list, and a
  `ListAgents` call for live subagents — never invent or suggest new work.
- Done rows: finished actions only (files changed, decisions made, commands run) — not
  intentions or discussion.
- By default, scope `Done` to items finished SINCE the most recent prior `/wip` or
  `/status` invocation visible earlier in this same conversation — find that invocation's
  own output in the conversation history and only include rows for work finished after
  it. No prior `/wip`/`/status` invocation in this conversation (first call): `Done`
  covers the whole session, same as today, no change. The user's own invocation text
  asking for the full history ("full", "whole session", "everything", "all of it", "/wip
  full") overrides the scoping and covers the entire session instead. Nothing finished
  since the last invocation is what triggers the empty placeholder under this scoping —
  not "nothing ever happened this session."
- Doing rows: things actually in progress right now. Fold agent/subagent status in here
  (same judgment `status.md` uses for its AGENTS section) — call `ListAgents` to
  enumerate subagents this session spawned, and give each running one its own Doing row;
  flag it as `⚠ Needs you` instead if it's stuck (running far longer than the task should
  reasonably take, or no sign of progress since launch — judge from context, don't guess
  a fixed time limit) and there's nothing left for the agent itself to do about it. An
  open PR awaiting review, merge, or CI is a Doing row unless it's actually stuck, in
  which case it's `⚠ Needs you`. Steady-state, always-on infrastructure (a
  continuously-running background process/daemon that's simply healthy and ticking, with
  no specific end-point) is NOT a Doing row on its own — only genuinely active,
  goal-directed work counts (a subagent on a specific task, a PR actually awaiting
  review/merge/CI). If a steady-state process is doing something concrete and current,
  report THAT specific activity, not the process's mere existence/health.
- Next rows: only steps already planned/agreed in this session — not new suggestions or
  ideas you're generating now.
- `Done`, `Doing`, and `Next` are always printed, in that order, even when empty — an
  empty one still gets its `## <Category>` heading and table, with one row reading
  `<item> | <detail>` filled in as `— | Nothing done yet.` (adjust the detail wording to
  fit the category: "Nothing in progress." for Doing, "Nothing else planned." for Next).
  `⚠ Needs you` is different: it has no empty-placeholder — omit the entire section
  (heading and table) when nothing is blocked on the operator.
- Don't re-run tools beyond the `ListAgents` check above, and don't re-derive information
  beyond what's already known in this session.
- No text beyond the section headings and their tables. No tail checklist, no summary
  line after them.
