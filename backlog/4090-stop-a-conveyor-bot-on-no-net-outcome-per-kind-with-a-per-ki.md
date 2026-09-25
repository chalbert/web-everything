---
bornAs: xgkl5ha
kind: story
size: 5
parent: "4075"
status: resolved
scope: ["we:scripts/conveyor/hung-session.mjs", "we:scripts/conveyor/session-reaper.mjs"]
dateOpened: "2026-09-24"
dateStarted: "2026-09-25"
dateResolved: "2026-09-25"
tags: []
---

# Stop a conveyor bot on no net outcome per kind, with a per-kind ceiling

Build clause 2 of #conveyor-session-lifecycle-policy (#4082). Today a bot stops only on 30 min of transcript silence, so a looping bot runs forever. Add a per-kind no-net-outcome window (build: lane diff vs base changed; fix: commit/push changing the net diff; review: comment or label; prepare: item file change) and a per-kind ceiling never above the lane lease TTL. Graceful stop then SIGTERM; record the stop as `stalled` so resume (#3366) relaunches instead. Seed values from #3368 step timings (about 2x p95); fallback build 45/240, fix 30/120, review 30/60, prepare 45/180 min.

## Done when

1. **Executable** — `npx vitest run we:scripts/conveyor/__tests__/hung-session.test.mjs we:scripts/conveyor/__tests__/session-reaper.test.mjs` fails before this item lands (missing `classifyNoOutcomeStall`/`resolveNoOutcomeWindowMs`/`resolveNoOutcomeCeilingMs`/`makeNoOutcomeResolver` exports, and `classifySessionReapWithGroundTruth` never reaps a `working` session for lack of a real outcome) and passes after. Live: `node we:scripts/conveyor/session-reaper.mjs --dry-run --json` against a real `claude agents --json --all` listing reports `no-outcome:*` candidates it previously never flagged.
