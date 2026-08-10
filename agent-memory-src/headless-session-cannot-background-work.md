---
name: headless-session-cannot-background-work
description: "A headless `claude -p` gets ONE uninterrupted pass — anything it backgrounds dies when the process exits and it never gets a completion turn, so run every check in the FOREGROUND. Its `--session-id` is honoured byte-for-byte, so a headless actor id is deterministic."
metadata:
  node_type: memory
  type: feedback
---

**Run everything in the foreground in a headless `claude -p`.** A headless invocation has exactly one
uninterrupted pass: when the model ends its turn the process exits, and there is no later turn in which a
background task's completion could be delivered. Work started in the background is simply lost.

**Measured 2026-08-09** (lane-3, `claude` 2.1.220). A headless run was asked to start
`sleep 45; date > <marker>` with `run_in_background: true`, not wait on it, and end its turn. It replied
*"Background command started (ID `b2mo4a9hq`), not waiting on it"* and the process exited ~18s after launch.
The marker file was then polled every 10s for a further 120s and **never appeared**.

**Related prior art — cite it, don't restate it.** [#2833](../backlog/2833-subagent-stall-reaping-detect-a-subagent-blocked-on-a-backgr.md)
(resolved 2026-08-02) covers the same *class* for **subagents**, and its delivered remedy is exactly the right
instruction here: run the checks **synchronously**. It shipped `scripts/verify-lane.mjs` (a blocking wrapper +
a `.git/.lane-verify` lifecycle marker), a finish-guard in `scripts/pr-land.mjs`, and a `PreToolUse(Bash)`
denial in `scripts/guard-bash.mjs` for a backgrounded `verify-lane` / `check:standards` / `test:unit` run.

Two things #2833 does not cover, which is why this memory exists:

- **The mechanism is different.** A subagent that backgrounds work *stalls* — it waits forever for a signal
  and holds its lane. A headless run *exits* — the work is killed and nothing is left to reap. #2833's
  detector/reaper half was split off to #2881 and addresses the stall, not the exit.
- **The scope is different.** The guard denies backgrounding for the **verification set** only. In a headless
  run the rule is broader: background **nothing** — not a check, not a fetch, not a sleep-and-poll.

**Same run, second fact: `--session-id` is honoured exactly.** Requested
`ef7ad597-3629-494e-acea-caff3347a0a7`; the result JSON's `session_id` was that same string. So a headless
invocation's actor id can be chosen in advance and recorded, which is what makes it a genuinely distinct
reviewer actor (a subagent instead inherits its parent's id — see #3048 and `skills-src/review/SKILL.md`).

Related: [[always-set-subagent-model-explicitly]], [[clearing-session-must-not-edit-the-branch]].
