---
bornAs: x5kagse
kind: story
size: 3
parent: "4075"
status: resolved
scope: ["we:scripts/conveyor/claude-auth-health.mjs", "we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs", "we:skills-src/conveyor/review-daemon.mjs", "we:scripts/operations/__tests__/helpers/fake-claude-shim.mjs", "we:scripts/conveyor/soak/breaks/claude-auth-dispatch-pause.mjs"]
dateOpened: "2026-09-26"
dateResolved: "2026-09-26"
tags: []
---

# Fix-dispatch and review daemons pause dispatch while the Claude login is broken

Follow-up to PR #2717 (we:scripts/conveyor/hung-session.mjs#classifyClaudeAuthExpired). Overnight 2026-09-25/26 the daemons kept redispatching a fresh fix/ci-heal/review session every tick while the operator's Claude login was expired, burning attempts all night. Add a shared claude-auth health read (we:scripts/conveyor/claude-auth-health.mjs: the open health-watch episode, or directly the most recently dispatched session's own transcript) plus a cheap 'claude auth status' probe, and gate dispatch in we:skills-src/conveyor/review-daemon.mjs and we:skills-src/conveyor/reconcile-fix-dispatch-daemon.mjs so they skip dispatching (logging 'paused: Claude login expired — run /login') while broken, resuming automatically once the probe confirms recovery, never burning a fix/review attempt or round cap while paused.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
