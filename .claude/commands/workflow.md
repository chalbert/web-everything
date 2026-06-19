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
the background, **progress streams to `/workflows`** (per-probe, per-lane, per-merge `log` lines) — watch it
there; the main chat shows the final ledger. A bare number sets the points budget; a `NNN`/`NNN-slug` seeds
the first item. Use `--serial` here to force the linear loop (same as `/batch`).

--parallel $ARGUMENTS
