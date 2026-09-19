---
bornAs: xrz1gcz
kind: story
size: 2
parent: "3405"
status: open
scope: ["we:scripts/guard-bash.mjs", "we:scripts/lib/judge-spawn.mjs"]
dateOpened: "2026-09-14"
tags: []
---

# Add guard-bash denylist entry for unscoped find / in dispatched/juror Bash calls (incident evidence for #3405)

Incident 2026-09-14/15 (~00:12-00:29 UTC): a security-lens juror reviewing PR #2117 (we:scripts/operations/review-pr.mjs judge recipe, spawned via we:scripts/lib/judge-spawn.mjs) ran a bare 'find / -iname config.toml' while investigating Codex sandbox config, consuming ~45% CPU for ~9 minutes before manual SIGTERM. Root cause: we:scripts/lib/judge-spawn.mjs's JUDGE_TIMEOUT_MS (20 min whole-process wall-clock kill, ~line 153) bounds the whole juror session but nothing bounds one internal Bash tool call, so a runaway single command can burn most of the 20-minute budget before the process-level timeout would catch it. #3405 (resolved) already ratified the fix shape for this exact class of problem: denylist by verb-class in we:scripts/guard-bash.mjs, gated on WE_DISPATCH_KIND, expand as each concrete case forces it (matching the one existing dispatchedAgentVerificationReason rule) -- NOT an allowlist, and NOT #3682 (a different subsystem: we:scripts/conveyor/verify-dispatch.mjs's tick-blocking execFileSync gate). This item is the next concrete case #3405 anticipated: add a we:scripts/guard-bash.mjs rule denying a bare/unscoped filesystem-root find (find / or find with no path / a root-equivalent path) from a WE_DISPATCH_KIND-gated Bash call. Filed as evidence/regular backlog work, NOT urgent -- the live incident self-resolved once the one offending process was SIGTERM'd (juror exited within ~30s, PR #2117 completed review-round:2 at 2026-09-15T00:24:30Z, and the runner's tick resumed on its own, spawning a fresh dispatch-lane child) -- so no dispatcher tick is currently blocked by this.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
