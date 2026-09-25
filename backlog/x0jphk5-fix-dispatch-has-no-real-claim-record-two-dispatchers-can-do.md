---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/reconcile-fix-dispatch.mjs", "we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs", "we:scripts/operations/ci-heal-pr-dispatch.mjs", "we:scripts/conveyor/fix-dispatch-claim.mjs", "we:scripts/conveyor/__tests__/fix-dispatch-claim.test.mjs"]
dateOpened: "2026-09-25"
tags: []
---

# Fix-dispatch has no real claim record - two dispatchers can double-dispatch a PR fix

we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs's own header claims dispatch is safe because we:scripts/conveyor/reconcile-fix-dispatch.mjs's dispatch decision already fences through we:scripts/operations/action-store.mjs's durable atomic per-resource claim ledger. False on main: we:scripts/conveyor/reconcile-fix-dispatch.mjs's own header says the opposite (name-based liveness, not a separate ledger - no action-store import anywhere in the file), and no we:scripts/conveyor/action-store.mjs exists at all (the real we:scripts/operations/action-store.mjs is never imported by the fix-dispatch path). The only guard is a session-name match against a claude-agents listing measured (we:scripts/operations/dispatch-lane-io.mjs) to lag 26+ seconds. So two dispatchers - the new daemon plus we:skills-src/conveyor/runner.mjs's own mechanical reconcile-fix-dispatch pass (deliberately run concurrently during the stated rolling-cutover bake period), or a restarted daemon racing a still-live prior instance - can both dispatch fix-<pr> (or ci-heal-<pr>) for one PR before the listing catches up. we:scripts/operations/ci-heal-pr-dispatch.mjs has the same false claim (says guardedDispatch keys on the PR; on main createDispatchSinks ignores the actions/repo params it is passed). Fix: add a real atomic per-(repo,PR,head-sha) claim - an O_EXCL file under a pinned shared state dir with owner/pid/host/session-id/TTL, dead-holder TTL reclaim - reusing we:scripts/readiness/file-locks.mjs's existing primitives. Wire it into dispatchFix, the ci-heal dispatch, and the resume path so all three take the claim before spawning/resuming and release it on a no-spawn outcome; expose a release hook for we:scripts/conveyor/session-reaper.mjs to call on reap (not edited here - owned by another worker). Fix both false header comments. Proof: vitest red-to-green (two concurrent dispatch attempts for one PR produce exactly 1 spawn) plus a live read-only fix-dispatch dry-run before/after showing the claim taken and refused for a duplicate.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
