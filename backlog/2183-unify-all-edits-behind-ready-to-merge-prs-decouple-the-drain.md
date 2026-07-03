---
kind: story
size: 3
status: open
relatedTo: ["2138", "2162", "2173", "2174", "2175"]
dateOpened: "2026-07-03"
tags: [lanes, drain, workflow, deferred-drain, non-blocking]
---

# Flip /workflow to defer-by-default: producer queues, skill launches a non-blocking drain

Graduate the #2174 producer flag to ON by default so `/workflow` no longer integrates inline: the producer stops at push+`queue` and returns immediately (non-blocking), and the batch skill then launches a **one-shot** `we:scripts/lane-drain.mjs drain` in the background (`run_in_background`) — or the `/drain` launcher — to land the queue out-of-band. Owner-ratified 2026-07-02 as the intended end-state of the #2138 deferred-drain epic (#2174 shipped it default-OFF "until proven E2E"). The key requirement is **non-blocking on both ends**: neither the producer nor the main loop waits on landing.

## Decision (ratified 2026-07-02)

- `/workflow` **defers by default** (`deferredDrain:true`), with an `--inline` escape hatch back to the proven in-script integrator.
- The **skill/main loop** launches the drain, **not** the workflow script: the sandboxed producer has no `child_process`, and the `watch` loop never exits so an `agent()` running it would block the workflow. The main loop `Bash`-launches a **one-shot `drain`** (`run_in_background: true`) after the Workflow returns.
- One-shot `drain` (lands the current queue, then exits), **not** the `watch` daemon — `watch` is only for a continuously-fed cross-session queue.

## Scope

1. **Producer default** — main loop passes `deferredDrain:true` in the `Workflow` args by default; `--inline`/`--serial` opt out. (`we:.claude/skills/batch-backlog-items/SKILL.md` + the invocation.)
2. **Non-blocking drain launch** — after `Workflow` returns, the skill fires `node we:scripts/lane-drain.mjs drain --batch=<slug>` via `Bash({ run_in_background: true })` (reuse the `/drain` launcher, commit 359d2652). Report the queued-couples ledger immediately; the drain lands out-of-band.
3. **Heartbeat retarget** — the liveness poll watches the *drain's* resolved-count/queue-depth, not the integrator's (the producer is already done).
4. **Docs** — `we:.claude/skills/batch-backlog-items/SKILL.md` "Parallel lanes" + the memory note: `/workflow` = defer-by-default; landing is the drain's job; supersedes the #2174 default-OFF stance.

## Open sub-fork — what the lane hands the drain (see discussion)

Does each lane **push a raw `lane/*` ref** (drain creates+merges the PR via `pr-land`, the current #2172 shape) OR **open its own PR on push** (drain just merges pre-made, already-CI'd PRs)? The latter unlocks parallel CI during lane work but spreads `gh` auth + PR-create across N lanes. Tracked separately; decide before implementing scope 2.

## Acceptance

- A `/workflow` batch returns from the producer without an inline merge phase; items land via a background drain; nothing blocks on landing.
- `--inline` still reaches the in-script integrator (fallback preserved).
- Prove E2E on one real multi-lane batch (the #1153 validation this default was gated behind).

Supersedes the "default OFF until proven" residual in #2174. Blocked by nothing — the drain machinery (#2172/#2173/#2175) is all resolved.
