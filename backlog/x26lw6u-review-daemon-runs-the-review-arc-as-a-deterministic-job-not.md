---
kind: story
size: 5
parent: "3383"
status: open
scope: ["we:scripts/operations/review-job.mjs", "we:scripts/operations/review-job-store.mjs", "we:scripts/operations/__tests__/review-job.test.mjs", "we:skills-src/conveyor/__tests__/review-daemon.test.mjs", "we:scripts/operations/review-dispatch.mjs", "we:scripts/conveyor/reconcile-pass.mjs", "we:scripts/conveyor/review-status-tag.mjs", "we:skills-src/conveyor/review-daemon.mjs", "we:skills-src/review/review-agent-brief.md"]
dateOpened: "2026-09-25"
tags: []
---

# Review daemon runs the review arc as a deterministic job, not a Claude wrapper session

The review daemon (we:skills-src/conveyor/review-daemon.mjs) dispatches a full claude --bg session per PR via we:scripts/operations/review-dispatch.mjs, whose brief (we:skills-src/review/review-agent-brief.md) is a fixed judgment-free arc: completion started, lane acquire, we:scripts/operations/review-loop-cli.mjs once, completion done, lane release. Measured since the 2026-09-24 restart: 388 wrapper sessions, ~27 active hours, ~11.3h idle-waiting on the loop, 213/388 never reached the loop, ~0.7 GB RSS each. The jurors review-loop-cli spawns are already fresh claude -p sessions; the only thing the wrapper contributes is a fresh CLAUDE_CODE_SESSION_ID as the clearer actor id, which a job can mint. Run the arc as a detached node job (we:scripts/operations/review-job.mjs) from the daemon, with liveness via a job record (pid) merged into the agent listing reconcile and review-status-tag already read, so double-dispatch protection and status labels keep working. No-lane defers to the next tick instead of burning a session. Keeps the claude --bg path behind an explicit opt-in; fix and ci-heal dispatch stay sessions. Prior art: we:scripts/operations/review-dispatch-wrapper.mjs on origin/lane/mechanical-dispatcher (#3908 graduation, #3647, #3970).

## Done when

1. **Executable** — `npx vitest run we:scripts/operations/__tests__/review-job.test.mjs` passes (the module does not exist before this item): the arc's effect order, the fresh actor id handed to acquire and the loop, #3647's non-zero-exit classification, no-lane deferral and its bound, timeout/crash cleanup, and job rows binding as `live-process` in reconcile and `review-status:reviewing` in the status tagger.
2. **Probed live** — with the review daemon running this code, a real open PR owed a review is reviewed with no `review-<pr>` Claude session (no new transcript under the daemon's project dir), its completion record goes `started` → `done` with the loop's run id, `we:scripts/operations/review-loop-cli.mjs` applies the review label, and the lane is released.

## Decisions (2026-09-25)

- **Freshness holds without the wrapper.** The jurors `we:scripts/operations/review-loop-cli.mjs` spawns are separate `claude -p` processes with their own derived session ids (`we:scripts/lib/judge-spawn.mjs`). The wrapper session supplied only `CLAUDE_CODE_SESSION_ID`, read as the clearing actor by `we:scripts/lib/review-independence.mjs`; the job mints a fresh UUID per round and passes it to its children, so a clear still records a distinct actor (never `unknown-clearer`).
- **Plain module, not an `op()` declaration.** The judged work already is the declared `review-pr` operation; the job is the harness around it, like `we:scripts/operations/dispatch-abort.mjs`.
- **Session path kept behind `WE_REVIEW_DISPATCH_MODE=session`.** Fix and ci-heal dispatch are untouched.
