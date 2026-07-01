---
description: Batch backlog items in PARALLEL via the Workflow orchestrator (provably-disjoint lanes, live /workflows progress)
---

Invoke the `batch-backlog-items` skill in its **parallel / workflow** execute mode (`--parallel`): same
conversational arc as `/batch` — pack → ordered plan → single "go" → reserve → close-out/calibrate — but the
**execute phase hands off to the `Workflow` tool** (`parallel-execute.workflow.js`), which probes each item's
real touch-set, partitions into **provably-disjoint lanes** worked concurrently in **isolated git clones**
(#1933 clone model — each lane pushes its commit to a throwaway `lane/*` ref), then a central integrator merges
those refs onto each repo's **main one-at-a-time with a full gate per merge** (rebase-and-retry on conflict,
serial-replay of a surviving conflict). The integrator lands directly on each repo's main, so **the main agent
does no landing merge** — it just reports the ledger. Reliability is identical to serial — uncertainty always
falls back to the serial lane, and with no disjoint pair the whole batch degenerates to serial (correct, not a
failure).

This is the **parallel counterpart to `/batch`** (which stays linear/serial). Because the orchestrator runs in
the background, **progress streams to `/workflows`** (per-probe, per-lane, per-merge `log` lines) — but this
VS Code extension has **no `/workflows` TUI**, so those lines are invisible and a 20–70 min run looks hung. A
bare number sets the points budget; a `NNN`/`NNN-slug` seeds the first item. Use `--serial` here to force the
linear loop (same as `/batch`).

## Liveness heartbeat (REQUIRED — do not let the run go dark)

The `Workflow` tool returns immediately with a `runId` and runs in the background; you're auto-re-invoked only
on **completion**. Without a heartbeat the chat shows nothing for the whole run — and worse, if a lane stalls
or dies you don't find out until the run ends ~1h later. So the moment the `Workflow` call returns, drive a
self-paced poll **that reviews health, not just progress**, until it finishes.

**Clock = a chained background `sleep`, NOT `ScheduleWakeup`.** `ScheduleWakeup` was observed to NOT fire
mid-run in this extension (only the terminal completion notification did) — so the interval heartbeat it drove
never appeared. A backgrounded shell command's **exit** rides the SAME task-notification wake path that
completion does (which demonstrably works), and it arrives as a notification rather than re-injecting this
whole `/workflow` prompt (so a tick can't be mistaken for a fresh batch). Each tick:

1. `Bash({ command: "sleep 120", run_in_background: true })` — its exit re-invokes you in ~120s (just under the
   5-min prompt-cache window, so ticks stay cheap). This is the timer.
2. On that wake, run the poller **in health mode** and forward its verdict to chat:
   `node .claude/skills/batch-backlog-items/workflow-progress.mjs --health`
   (auto-selects the newest run; pass the `runId` to pin one). Its first two lines are machine-readable:
   `STATUS=running|completed|failed …` and `HEALTH=ok|warn|done STALLED=<n> ERRORS=<n> THRASH=<n>`.
3. **While `STATUS=running`**: post the heartbeat block — done/launched, what each running agent is doing, and
   the **health verdict**. Then start the next `sleep 120` background tick.
   - **`HEALTH=ok`** → all running agents are live; a one-line "N running, all healthy" is enough.
   - **`HEALTH=warn`** → the poller lists each flagged agent (`stall` / `error` / `thrash`) with its label.
     **Surface it immediately.** If it persists across ~2 ticks (a genuinely wedged run, not a slow step),
     `TaskStop` the run and fall back to a serial `/batch` — don't wait out the hour.
4. **When `STATUS=completed|failed`**: stop the tick loop (the completion notification also fires); report the
   final ledger and surface `multiLaneFiles` / `stranded` / `partialCrossRepo` / `probeFailures`. There is no
   landing merge to do — the clone integrator already landed every lane on each repo's main.

The cadence lives here in the main loop, not in the workflow script — a background poll can't post to chat,
and the script itself is `await`-blocked while a lane runs so it can't watch a lane go idle. Two watchdog
layers cover the two failure shapes: this out-of-band health poll catches a **hung/idle/erroring lane** (only
visible via transcript mtimes), and the orchestrator's in-script circuit-breaker catches a **probe-storm**
(≥50% of probes dying = API outage) by aborting `aborted:'probe-storm'` before any claim — so that fault rides
the completion wake in seconds.

--parallel $ARGUMENTS
