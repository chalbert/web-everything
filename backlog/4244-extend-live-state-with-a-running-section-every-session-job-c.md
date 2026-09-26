---
bornAs: x20lkf6
kind: story
size: 5
parent: "3931"
status: open
scope: ["we:scripts/operations/live-work.mjs", "we:scripts/operations/live-work-io.mjs", "we:scripts/operations/__tests__/live-work.test.mjs", "we:scripts/operations/run.mjs"]
dateOpened: "2026-09-26"
tags: []
---

# Extend live-state with a RUNNING section — every session/job, card/PR, kind, runtime, last activity, state, transcript

Add a RUNNING section (new we:scripts/operations/live-work.mjs, sibling to we:scripts/operations/live-state.mjs card 4213/#4213) joining we:scripts/operations/agent-activity.mjs (#3932), claude agents --json, review-job records (we:scripts/operations/review-job-store.mjs, .operations/review-jobs/*.json) and we:scripts/operations/heavy-queue.mjs — reusing every read, never re-deriving. For every session/job (background fix/ci-heal/build/prepare/review/canary dispatches, interactive chats, orchestrator workers + identifiable subagents): work item, kind, start time + runtime, last activity (transcript's last write), derived state (working/waiting-for-slot/idle>10min/blocked-on-prompt/dead), transcript path. Sort stuck+dead first. Feeds card 4245's plateau-app panel.

## Done when

1. **Executable** — we:scripts/operations/__tests__/live-work.test.mjs passes under `npx vitest run
   we:scripts/operations/__tests__/live-work.test.mjs` with fixtures for: a fixer session, a review job
   (`.operations/review-jobs/<slug>.json`), and an interactive chat, each classified into the right derived
   state (working / waiting for a test slot / idle>10min / blocked on a permission prompt / dead), sorted
   stuck+dead first; a session with no matching card/PR still returns a row (unmatched, never dropped); a job
   whose pid is dead is classified `dead`, never `working`.
2. **Live** — with real sessions/jobs on this machine, `node we:scripts/operations/run.mjs live-work --json`
   (or `live-state --json`'s `running` section) returns rows for at least one review job, one fixer/background
   dispatch, and the operator's own interactive chat, each with a real, non-empty transcript path that resolves
   on disk.
