---
bornAs: xbsmmwu
kind: story
size: 5
parent: "4075"
status: open
scope: ["we:scripts/conveyor/session-reaper.mjs", "we:scripts/conveyor/hung-session.mjs", "we:scripts/conveyor/reconcile-core.mjs", "we:scripts/conveyor/reconcile-pass.mjs", "we:scripts/conveyor/health-smells/claude-auth-expired.mjs", "we:scripts/conveyor/health-smells/index.mjs", "we:scripts/conveyor/health-watch.mjs", "we:scripts/conveyor/health-watch-core.mjs", "we:scripts/conveyor/soak/breaks/claude-auth-expired.mjs", "we:scripts/conveyor/__tests__/sim/agent-actions.mjs"]
dateOpened: "2026-09-26"
tags: []
---

# Claude auth-expired session detection — reaper + reconcile liveness + health-watch sign

LIVE INCIDENT night 2026-09-25/26 ET: the operator's Claude login expired; every daemon-dispatched session (ci-heal-2711/2712) ended immediately on the CLI's own auth failure and sat blocked/idle for hours. (a) the reaper never stopped them; (b) we:scripts/conveyor/reconcile-core.mjs#assessLiveness counted them as live holders (reconcile-refused live-process), so no fresh fixer was ever sent; (c) nothing alerted the operator (we:scripts/conveyor/health-smells/bad-credentials.mjs only covers GitHub 401s). Fix: a shared detector we:scripts/conveyor/hung-session.mjs#classifyClaudeAuthExpired/readClaudeAuthExpiredInfo matching the real transcript shape — only the CLI's own synthetic `isApiErrorMessage` turn, with error `authentication_failed` or the "Login expired · Please run /login" text, never model prose about 401s (PR #2717 review; false-positive soak scenario we:scripts/conveyor/soak/breaks/claude-auth-false-positive.mjs) — wired as a new axis in we:scripts/conveyor/session-reaper.mjs (reaps at once, backstop outcome blocked-on-infra + label claude-auth) and a new we:scripts/conveyor/reconcile-core.mjs#markAuthExpiredSessions pre-pass (assessLiveness now excludes authExpired rows, wired via we:scripts/conveyor/reconcile-pass.mjs), plus a new health-watch sign we:scripts/conveyor/health-smells/claude-auth-expired.mjs (probe in we:scripts/conveyor/health-watch.mjs) that is the first sign to set notifyEvenInShadow (new field in we:scripts/conveyor/health-watch-core.mjs#planActions) and the first to actually SEND a desktop notification via the existing we:scripts/conveyor/branch-sync.mjs#notifyDesktopChecked primitive — tick() never sent one in any mode before this. A new soak scenario we:scripts/conveyor/soak/breaks/claude-auth-expired.mjs proves the reconcile fix end-to-end against the real fix-dispatch daemon. Dispatchers skipping while the episode is open is left as an explicit follow-up, not done here.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
