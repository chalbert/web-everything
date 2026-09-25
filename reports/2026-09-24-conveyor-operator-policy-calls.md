# Conveyor operator policy calls — grounding + prior art (#4082)

Prep report for `/backlog/4082-operator-pending-conveyor-policy-calls-session-cleanup-reten/`. Five operator
calls left open by the 2026-09-24 incident. This report records what the tree does today and what comparable
systems do, so each fork's default rests on evidence, not on the incident-day leaning.

## What the tree does today

| Concern | Today | Where |
| --- | --- | --- |
| Finished-session cleanup | `claude stop` on finished background sessions only. Nothing runs `claude rm`, nothing deletes our own records. The Claude Code jobs directory holds 1581 entries; `.operations/runs/` holds 92. Delete helpers exist but nothing calls them. | `we:scripts/conveyor/session-reaper.mjs:640`, `we:scripts/operations/run-store.mjs:121` |
| Lane leases | Freed after 240 min or when the session is confirmed gone. | `we:scripts/lib/lane-lease.mjs:35`, `we:scripts/conveyor/lease-reaper.mjs` |
| Orphan claims | An `active` card with no live owner goes back to `open` after 48 h. | `we:scripts/conveyor/orphan-claim-release.mjs:70` |
| Transcripts | Not touched by us. Claude Code's own `cleanupPeriodDays` setting (default 30 days, unset on this host) deletes them. | the user-level Claude Code settings file |
| Stuck session | Stopped after 30 min of transcript silence (×3 grace while a tool call is pending). A session that keeps writing (a loop) is never "silent", so never stopped. No per-kind budget. | `we:scripts/conveyor/hung-session.mjs:68`, `we:scripts/conveyor/hung-session.mjs:78` |
| Stuck PR | Per-stage no-progress limits (review 45, fix 45, approved 30, conflict 45 min). Diagnoses only; never stops a worker. | `we:scripts/conveyor/stuck-pr-watch-core.mjs:77` |
| Cleanup scope | Reaper skips any non-background row and relies on the dispatcher's session-name pattern. Agent-tool subagents never appear in `claude agents`. Nothing links a chat-spawned background worker to the chat that spawned it. | `we:scripts/conveyor/session-reaper.mjs:162` |
| Daemon auth | Every bot inherits the operator's subscription login from the `claude` CLI. No per-bot credential knob. `--bare` is banned because it needs an API key. | `we:scripts/operations/dispatch-lane-io.mjs:1173`, `we:scripts/operations/deliver-item-wrapper.mjs:489`, `we:scripts/lib/judge-spawn.mjs:49` |
| Resume | Only two resume paths: fix work resumes the PR's original builder, and the gate-failure retry. An interrupted worker is re-dispatched fresh after its guard TTL. | `we:scripts/conveyor/reconcile-fix-dispatch.mjs:540`, `we:scripts/operations/deliver-item-wrapper.mjs:980` |

Open cards already on this turf: #3367 (watch for progress, not a clock — spawn level), #3366 (resume an
expired agent instead of relaunching; blocked by #3331), #3368 (step timings, resolved — the duration data),
#2881 (subagent-stall backstop), #4071 (cost per bot).

Statutes on this turf: `#agent-runner-cli-backend` (`we:docs/agent/platform-decisions.md:3181` — subscription CLI
now, API-key backend later behind the same interface; graceful stop then SIGTERM; `--resume` a clean pause, never
a turn killed for looping), `#automated-session-introspection` (`:4576` — every terminal session is introspected
from its transcript), `#parked-pr-conflict-dispatched-not-scripted` (`:4714` — prefer resuming the original
builder).

## Prior art

- **Retention keyed to the owning object, with a cap.** Kubernetes Jobs are garbage-collected by
  `ttlSecondsAfterFinished` counted from *completion*, and owned objects go when their owner goes. GitHub
  Actions keeps run logs and artifacts for a fixed period (90 days default, configurable). Claude Code keeps
  transcripts `cleanupPeriodDays` (30 days default). Pattern: the clock starts at a terminal event, and a
  fixed ceiling catches anything whose owner never terminates.
- **Two timeouts, not one.** Temporal activities carry a *heartbeat timeout* (no progress reported for N) and a
  *start-to-close timeout* (hard ceiling), per activity type. Kubernetes Deployments carry
  `progressDeadlineSeconds` (no progress) separately from any overall limit. GitHub Actions has only a wall
  clock (`timeout-minutes`, default 360) — the design #3367 argues against. Pattern: a per-kind no-progress
  window is primary; a generous ceiling is the backstop for noisy-but-stuck work.
- **Resume by the owner, with a poison cap.** Temporal retries an activity from its owning workflow with a
  bounded retry policy and non-retryable error types. That is the shape #3366 already writes: the owning
  dispatcher resumes, a loop-killed or repeatedly-resumed session is relaunched fresh.
- **Credentials per workload.** CI systems scope a secret per job, not per runner. That makes auth a per-bot
  setting (a config knob), not a global either/or.
