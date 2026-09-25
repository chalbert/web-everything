---
bornAs: xb3q26f
kind: story
size: 2
parent: "3383"
status: resolved
dateOpened: "2026-09-25"
dateStarted: "2026-09-25"
dateResolved: "2026-09-25"
tags: []
---

# Session-reaper backstop records blocked-on-infra correctly; assessLiveness treats a stopped session as finished

Live incident (PR 2647/2625): a crashed review session's transcript stated blocked-on-infra but the reaper's backstop wrote the generic unreported-exit outcome, and assessLiveness never treated a claude-stop'd (state:stopped) session as finished, so the PR sat review-stalled with nothing retrying it. Fix: we:scripts/conveyor/session-reaper.mjs reads the transcript tail to detect an intended blocked-on-infra self-report; we:scripts/conveyor/reconcile-core.mjs assessLiveness now treats state:stopped as finished, same as done.

## Done when

1. **Executable** — `npx vitest run we:scripts/conveyor/__tests__/session-reaper.test.mjs we:scripts/conveyor/__tests__/reconcile-core.test.mjs` fails before this item lands (missing `transcriptShowsIntendedBlockedOnInfra`/`BLOCKED_ON_INFRA_OUTCOME` exports, and `assessLiveness` refuses a `state:'stopped'`-only bound session as `liveness-unknown`) and passes after.
