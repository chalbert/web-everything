---
name: background-dispatch-must-carry-out-and-subscribe
description: a `claude --bg` dispatch prompt must say to CARRY OUT the brief (not just Read it) and the orchestrator must subscribe to an idle notice; otherwise workers sit idle and nothing wakes the orchestrator
metadata:
  type: feedback
---

Two rules for dispatching background workers with `claude --bg`:

1. **The prompt must order the work.** "Read <brief>" only asks the session to read; on 2026-09-20 two workers (wip-honest-remedy, reaper-split) read the brief and stopped, idle for hours, while I reported one as working. Use: "You are a delivery worker dispatched by the operator's orchestrator session. Your assignment is the task brief in <file>. That brief IS your instruction: read it, then carry it out completely and exactly as written (every step, the rules, the tool limits, and the result file it names). Do not stop after reading and do not ask for confirmation; the operator has already approved this work."
2. **Subscribe right after every spawn.** A `claude --bg` session never wakes the orchestrator. `SendMessage` with `notify_when_idle: true` (no message) gives one idle-or-exit notice per subscription. Idle is not always done (a blocked worker also goes idle), so read the result file and `claude agents --json` when the notice arrives. Harness-tracked jobs (Workflow tasks) notify on their own.

**Why:** the pinned CLAUDE.md rule against assuming a backgrounded call will wake me, and the 2026-09-20 incident where "I'll report when it finishes" was an empty promise for three workers.

**How to apply:** every dispatch, template above plus an immediate subscription. Never say "I'll show you when it finishes" for a session I did not subscribe to; poll it or say nothing will wake me. See [[tracked-items-means-tracker]].
