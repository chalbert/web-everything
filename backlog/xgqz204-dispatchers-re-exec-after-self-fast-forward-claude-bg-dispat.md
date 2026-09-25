---
kind: story
size: 5
status: active
scope: ["we:scripts/lib/main-staleness.mjs", "we:scripts/operations/dispatch-lane-io.mjs", "we:scripts/operations/explore-io.mjs", "we:scripts/guard-bash.mjs", "we:scripts/operations/review-dispatch.mjs", "we:scripts/operations/review-job.mjs", "we:scripts/operations/ci-heal-pr-dispatch.mjs", "we:scripts/conveyor/reconcile-fix-dispatch.mjs"]
dateOpened: "2026-09-25"
dateStarted: "2026-09-25"
tags: []
---

# Dispatchers re-exec after self-fast-forward; claude --bg dispatches carry the worker marker so the wait-poll guard denies

Two defects traced live 2026-09-25. (1) A dispatcher CLI that fast-forwards its own checkout at the #3474 chokepoint (we:scripts/lib/main-staleness.mjs#assertMainNotStale) keeps running its OLD in-memory code: review-dispatch FF'd 47 commits incl. PR #2674 (job-mode default) yet still started a claude --bg review SESSION. Fix: after an FF that changed code in the checkout the running code came from, an armed CLI re-execs itself (same argv, loop-guard env), and an un-armed caller refuses instead of proceeding. (2) claude --bg sessions (review/fix/ci-heal/stuck-inspect/build) never see the worker marker because --bg does not inherit ambient env, so the #x36vidg wait-poll arm in we:scripts/guard-bash.mjs only warns. Fix: deliver WE_CONVEYOR_WORKER=1 through --settings env (proven live to reach the hook process env, spare-pool claims included) in we:scripts/operations/dispatch-lane-io.mjs#buildAgentArgv and the explore panelist argv, and treat the worker marker as an agent session in the guard. WE_DISPATCH_KIND is deliberately NOT stamped: it arms the #3105 verification deny, which would block the verify-lane run the fix/ci-heal briefs mandate.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
