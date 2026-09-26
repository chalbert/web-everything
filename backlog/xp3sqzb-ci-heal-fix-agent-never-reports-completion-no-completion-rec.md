---
kind: story
size: 3
parent: "4075"
status: active
scope: ["we:scripts/operations/completion-record.mjs", "we:scripts/operations/completion-cli.mjs", "we:scripts/conveyor/session-reaper.mjs", "we:scripts/conveyor/reconcile-core.mjs", "we:scripts/conveyor/reconcile-pass.mjs", "we:scripts/conveyor/hung-session.mjs", "we:skills-src/conveyor/fix-agent-ci-brief.md"]
dateOpened: "2026-09-26"
dateStarted: "2026-09-26"
tags: []
---

# ci-heal fix agent never reports completion — no completion-record kind, sessions count as live holders forever

LIVE incident (PR #2724, 2026-09-26 ~13:50-14:10 ET): ci-heal-2724 finished (rebased onto main and pushed; no code change was needed) but stayed listed working — the fix-dispatch daemon logged reconcile-refused live-process for PR #2724 for 20+ minutes, blocking its review dispatch, until the 30-min hung-transcript ceiling eventually reaped it. Same pattern as #2711 this morning.

Root cause: we:scripts/operations/completion-record.mjs's COMPLETION_KINDS has no ci-heal entry, and we:skills-src/conveyor/fix-agent-ci-brief.md never instructs a ci-heal session to run we:scripts/operations/completion-cli.mjs report --status=done (unlike we:skills-src/conveyor/fix-agent-brief.md / we:skills-src/conveyor/stuck-pr-inspect-brief.md / we:skills-src/review/review-agent-brief.md, which all do). we:scripts/conveyor/session-reaper.mjs's BACKSTOP_COMPLETION_KINDS and we:scripts/conveyor/reconcile-core.mjs already document this exact gap in their own comments without fixing it.

Fix: (a) add ci-heal to COMPLETION_KINDS + sessionSlugForCompletion + BACKSTOP_COMPLETION_KINDS; add a report --status=started step at the top and report --status=done at every exit of we:skills-src/conveyor/fix-agent-ci-brief.md, mirroring we:skills-src/conveyor/fix-agent-brief.md. (b) once (a) lands, markSelfReportedDone and the reaper's completion-record axis already honour any kind's status:done record with no further code change (both are kind-agnostic) — proven, not assumed. (c) backstop, every kind: a session whose last assistant turn has fully ended (no pending tool call) and has been idle more than 10 minutes is treated as finished for liveness, in case a brief forgets to report again — new classifyIdleFinished/readIdleFinishedInfo (we:scripts/conveyor/hung-session.mjs), markIdleFinishedSessions (we:scripts/conveyor/reconcile-core.mjs, wired into assessLiveness/defaultReadAgents), and a matching reaper axis + resolver (we:scripts/conveyor/session-reaper.mjs), env-tunable via WE_IDLE_FINISHED_MINUTES.

Also audited: we:skills-src/conveyor/delivery-agent-brief.md (build) and we:skills-src/conveyor/prepare-decision-agent-brief.md / we:skills-src/conveyor/prepare-scope-agent-brief.md (prepare) have no completion-cli calls either, but that is NOT the same gap — their kind (conveyor/prepare/prepare-decision) is covered instead by the separate no-outcome window/ceiling axis in we:scripts/conveyor/hung-session.mjs (NO_OUTCOME_KINDS), an already-built backstop that needs no self-report. we:skills-src/review/review-agent-brief.md + we:scripts/operations/review-job.mjs already report started/done correctly. No canary brief exists yet to audit.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
