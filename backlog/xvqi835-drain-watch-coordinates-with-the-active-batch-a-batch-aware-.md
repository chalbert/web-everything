---
kind: story
size: 3
status: open
dateOpened: "2026-07-08"
tags: []
---

# Drain --watch coordinates with the active batch: a batch-aware stop gate

Today /drain watch has no stop signal tied to the running batch — the only bound, --max-idle=N, is unsafe for a live batch (items take minutes, so the watch goes idle *between* PRs and would exit while the batch is still producing). Teach we:scripts/merge-ai-prs.mjs --watch a batch-aware exit (e.g. --until-batches-idle) that reads the SAME feed the active tab uses (we:_site/active-progress.json, written by we:scripts/dev/active-progress-watch.mjs): exit only when no kind:batch status:running run remains AND the ready-to-merge queue is empty AND nothing is deferred. Why: a drain launched to land a batch output should self-terminate when that batch is fully delivered, instead of running unbounded or stopping early.

## The signal

`we:_site/active-progress.json` (the dev-only feed `we:scripts/dev/active-progress-watch.mjs` writes, and the website's active tab reads via `we:src/assets/js/backlog-active.js`) already exposes each running batch as a `runs[]` entry: `{ kind: "batch", status: "running", nums: [...] }`. A batch's journal goes terminal (`completed`/`failed`/`aborted`/`cancelled`/`killed`) when its produce loop finishes, at which point the run drops out of `runs[]`. That flip is the "producers are done" edge the drain lacks.

## Proposed exit gate (`--until-batches-idle`)

Each `--watch` pass, after the merge sweep, evaluate exit = **all three** true:
1. no `kind:batch status:running` run remains in the feed;
2. the `ready-to-merge` queue is empty (no open labelled PRs across the swept repos);
3. nothing deferred/pending-rebase this pass.

## Caveats to bake in (else it stops wrong)

- **Feed absent/stale ⇒ keep watching, NEVER stop.** The feed 404s on a static publish and only exists while the dev watcher runs. Treat a missing/old feed as "unknown ⇒ keep polling", so no feed can ever trigger a false stop (degrade to the current unbounded behaviour).
- **Debounce the terminal edge.** Require the batch observed non-running for ≥2 consecutive passes to absorb feed lag before honouring condition 1.
- **Gate on queue-empty, not "all `nums` resolved".** A batch item can be dropped/parked and never land; keying the exit on every `num` reaching `resolved` would hang the drain forever. Queue-empty + batch-terminal is the safe conjunction.

Keep it **opt-in** (a flag), leaving bare `--watch` unbounded (Ctrl-C) and `--max-idle` as-is.

## Review notes (design considerations, from PR review)

Carry these into implementation — they refine the caveats above, they don't block the story:

- **Prefer the journals over the derived feed.** `we:_site/active-progress.json` is a *dev-only* artifact the website's active tab reads; having the drain (a git/PR tool) depend on it is a coupling smell. The feed is derived from the batch **journals** — reading those directly removes the dependency on the website's dev watcher being up, and closes the completeness gap below. If the feed is kept for convenience, treat the journals as the source of truth.
- **Exit condition 1 assumes the feed is a *complete* registry of running batches.** Feed-absent⇒keep-watching makes a *missing* feed safe, but if the dev watcher is up while a batch runs in a context that doesn't publish to `runs[]`, condition 1 reads "no batch running" falsely and the ≥2-pass debounce (which only absorbs *lag*, not a structural miss) won't catch it → early stop. Reading journals directly avoids this; otherwise the story must pin down exactly which process publishes every running batch.
- **State the assumed writer for a drain-only session.** The drain and the dev watcher are frequently separate invocations. The story should say which process is expected to be writing the feed while a bare `/drain --until-batches-idle` runs, so the operator knows the flag is only meaningful when that process is live (and harmlessly unbounded otherwise).
