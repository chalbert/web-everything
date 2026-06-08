---
type: idea
workItem: story
size: 5
status: open
dateOpened: "2026-06-06"
tags: [agent-coordination, file-locking, multi-agent, hooks, dev-workflow, concurrency]
crossRef: { url: /backlog/, label: Backlog }
---

# Agent file-lock coordination — JIT temporary ownership with queue + safeties

When multiple agents work on **close features that sometimes touch the same files**, and you
**don't know upfront which files an agent will edit**, we want agents to **negotiate temporary
ownership of a file just-in-time** — a short-held lease acquired right before an edit and released
right after — backed by a **queue** for contention and **safety mechanisms** against crashes and
deadlock. This is the unpredictable-overlap residual that the cheaper rules (partition by Project,
single-writer on hot files) don't cover.

## Core model

Ownership is discovered lazily, so the lock must be **just-in-time and fine-grained**: claim a file
immediately before editing, hold for seconds, release immediately after — **not** "own this file for
my whole task." A shared on-disk `.locks/` registry (one lockfile per path, atomic create via
`mkdir`/`O_EXCL`) holds `{agentId, intent, acquiredAt, ttl}`. Acquire → edit → release; contention
appends to a per-file FIFO queue; release wakes the head. Plain filesystem state means it works
across fully independent agent sessions with no shared runtime.

## Key decisions (recommendations in bold)

- **Enforcement — advisory vs hook-enforced.** **Hook-enforced.** A `PreToolUse` hook on
  `Edit`/`Write` intercepts every edit, looks up the lock, and **denies with feedback** ("`X` held by
  agent-3, you're queued at position 2") or auto-acquires; `PostToolUse` releases. The harness
  enforces it, not the agent's goodwill — the only version that is actually a lock rather than a
  convention. Advisory (agents told to check) is simpler but one undisciplined agent breaks the
  invariant.
- **Crash safety.** **TTL + heartbeat.** A lease expires after N seconds unless refreshed; an expired
  lock is treated as free and the steal is logged. A dead agent must never hold a lock forever.
- **Deadlock avoidance.** **No-hold-while-blocked** (release what you hold and requeue when blocked),
  since the file set isn't known upfront so lock-ordering / all-or-none acquisition isn't feasible.
- **Granularity.** File-level locks are too coarse for the hottest files (`semantics.json`,
  generated inventory) where everyone appends. **Keep those single-writer by policy** (one merge
  agent) and reserve the lock mechanism for normal per-entry `*.json`/`*.njk` files where contention
  is rare and short. Do **not** attempt mechanical sub-file/section locking — brittle.
- **Queue fairness.** FIFO with a TTL on *queued* waiters too, so a stalled waiter drops out and
  can't wedge the line.

## Related — propagation (separate but adjacent)

Locking prevents collisions; it does not handle an in-flight agent **picking up what another just
shipped**. That is a **pull-not-push** concern: agents re-read source-of-truth (`semantics.json`, the
relevant `*.json`) and sibling `backlog/*.md` status notes at the **start of each step**, plus
`git rebase` at step boundaries on branch-based work. Worth codifying alongside, but distinct from the
lock mechanism.

## Proposed v1 (when picked up)

A tiny `lock.mjs` (acquire/release/queue against `.locks/`) + a `PreToolUse`/`PostToolUse` hook in
`settings.json` that calls it, validated on two parallel agents reaching for the same per-entry file.
Anything heavier (central broker, sub-file locks) is over-engineering for this repo's scale.

## Honest scope note

Most of the value here is already covered by partition-by-Project + single-writer-on-hot-files. This
item earns its keep **only** for coincidental same-file overlaps between agents whose file sets
weren't known ahead of time. Keep it minimal.
