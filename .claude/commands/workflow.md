---
description: Batch backlog items in PARALLEL via the Workflow orchestrator (provably-disjoint lanes, live /workflows progress)
---

Invoke the `batch-backlog-items` skill in its **parallel / workflow** execute mode (`--parallel`): same
conversational arc as `/batch` — pack → ordered plan → single "go" → reserve → close-out/calibrate — but the
**execute phase hands off to the `Workflow` tool** (`parallel-execute.workflow.js`), which probes each item's
real touch-set, partitions into **provably-disjoint lanes** worked concurrently in isolated git worktrees,
merges them one-at-a-time onto a throwaway integration branch with a full gate per merge (replaying any
conflicted lane serially), then the main agent lands the integration branch in one merge. Reliability is
identical to serial — uncertainty always falls back to the serial lane, and with no disjoint pair the whole
batch degenerates to serial (correct, not a failure).

This is the **parallel counterpart to `/batch`** (which stays linear/serial). Because the orchestrator runs in
the background, **progress streams to `/workflows`** (per-probe, per-lane, per-merge `log` lines) — but this
VS Code extension has **no `/workflows` TUI**, so those lines are invisible and a 20–70 min run looks hung. A
bare number sets the points budget; a `NNN`/`NNN-slug` seeds the first item. Use `--serial` here to force the
linear loop (same as `/batch`).

## Liveness heartbeat (REQUIRED — do not let the run go dark)

The `Workflow` tool returns immediately with a `runId` and runs in the background; you're auto-re-invoked only
on **completion**. Without intervention the chat shows nothing for the whole run. So the moment the `Workflow`
call returns, drive a self-paced poll until it finishes:

1. `ScheduleWakeup({ delaySeconds: 120, prompt: "<this same /workflow input>", reason: "workflow heartbeat" })`
   — 120s stays just under the 5-min prompt-cache window, so ticks are cheap.
2. On each wake, run the one-shot poller and forward ONE line to chat:
   `node .claude/skills/batch-backlog-items/workflow-progress.mjs`
   (it auto-selects the newest run; pass the `runId` to pin a specific one). Its first stdout line is
   machine-readable: `STATUS=running|completed|failed DONE=<n> LAUNCHED=<m> RUNNING=<r> IDLE_S=<secs>`.
3. **While `STATUS=running`**: post the human heartbeat block (done/launched, what each running agent is doing,
   last-activity age) and `ScheduleWakeup` again for another 120s. If `IDLE_S` climbs past ~180s the poller
   flags a possible stall — surface that.
4. **When `STATUS=completed|failed`**: stop scheduling (the completion notification also fires); report the
   final ledger and, on completion, land the integration branch as the script's closing `log` instructs.

The cadence lives here in the main loop, not in the workflow script — a background poll can't post to chat;
only you can. The script already emits rich `log()` lines; this just forwards their on-disk equivalent.

--parallel $ARGUMENTS
