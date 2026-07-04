---
name: forward-background-progress-into-chat
description: VS Code extension has no /workflows TUI; forward background-workflow progress into chat via an event-driven file-watcher that exits to re-invoke
metadata: 
  node_type: memory
  type: feedback
  originSessionId: aaf4013b-8c1c-42d3-81c5-6ae5d29c1141
---

When a long background job runs (a `/workflow` orchestrator, a long Bash task), the user wants **per-event progress forwarded into the chat**, not just a final summary.

**Why:** the live `/workflows` TUI panel (and `log()` stream) is a **terminal-CLI feature** — it does NOT exist in the **VS Code native extension**, which is where this user works. So background `log()` lines have nowhere to surface in-chat; the chat goes silent until completion.

**How to apply:** the agent is turn-based — it can only post when re-invoked (task-completion, background-command exit, or a scheduled wakeup), so there is **no true streaming**; one push = one turn.

For `/workflow` (parallel batch) this is now WIRED: the command doc (`.claude/commands/workflow.md` → "Liveness heartbeat") instructs the main loop to `ScheduleWakeup({delaySeconds:120})` right after the `Workflow` tool returns, and on each tick run `node .claude/skills/batch-backlog-items/workflow-progress.mjs` (one-shot poller, added 2026-06-27) and forward one line, rescheduling until its first stdout line reads `STATUS=completed|failed`. The poller reads the run's LIVE on-disk artifacts: `<session>/subagents/workflows/<wf_id>/journal.jsonl` (a `started`+`result` per agent ⇒ done/launched counts) and each `agent-<id>.jsonl` (transcript tail ⇒ what each running agent is doing + mtime for stall detection, flags `IDLE_S>180`). The final summary `<session>/workflows/<wf_id>.json` appears only at completion (carries `logs[]`/ledger). 120s stays under the 5-min prompt-cache TTL; floor for chat-forwarded wakeups is 60s.

For ad-hoc long jobs, the generic fallback is an **event-driven watcher**: a background bash script that blocks until a signal file changes, prints new lines and **exits** — the exit re-invokes the agent, which posts + **relaunches** the watcher (relaunch via the Bash tool, not a self-spawned nohup, or its exit won't notify). For true real-time, the user can run `claude` in the integrated terminal (`/workflows` works there) or `tail -f` a poll-logfile. Validated live 2026-06-19; poller mechanism 2026-06-27. Related: [[reference_repo_constellation]].
