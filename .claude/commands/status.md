---
description: Print a concise status of this session — done, doing, next — in a fixed format.
---

Print a status report for this session. Output **only** the block below, filled in — no
preamble, no text before or after it, nothing added or removed from its structure.

Always use exactly this format, in this order, every time:

```
DONE
- <completed step> — <1-line result>
- ...

DOING
- <current step, or "nothing in progress">

AGENTS
- <subagent name> — <status> <"— possibly stuck" if flagged>
- ...
(or: "No background agents running." if there are none)

NEXT
- <planned step>
- ...
(or: "No further steps planned." if there are none)
```

Rules:

- Pull from this conversation's actual history and any active todo list — don't invent
  steps that weren't discussed or done.
- Each bullet is one line. No sub-bullets, no nested explanation.
- DONE lists finished actions only (files changed, decisions made, commands run) — not
  intentions or discussion.
- DOING is the single thing in progress right now, or explicitly says nothing is.
- AGENTS: call the ListAgents tool to enumerate any subagents this session spawned. For
  each running one, flag it "possibly stuck" if it has been running far longer than the
  task should reasonably take, or if there's no sign of progress since it was launched —
  judge from context, don't guess a fixed time limit. Agents that finished or were never
  launched don't need a line; if none were ever launched, use the "No background agents
  running." fallback.
- NEXT lists only steps already planned/agreed in this session — not new suggestions or
  ideas you're generating now.
- If a section is empty, say so in one line (e.g. "Nothing done yet.") — never omit a
  section header.
- Don't re-run tools beyond the ListAgents check above, and don't re-derive information
  beyond what's already known in this session.
- No headers/sections beyond DONE / DOING / AGENTS / NEXT. No tail checklist, no summary
  line after the block.
