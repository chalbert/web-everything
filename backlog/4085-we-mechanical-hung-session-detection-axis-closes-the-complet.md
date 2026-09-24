---
bornAs: xbv32pg
kind: story
size: 5
parent: "3383"
status: resolved
dateOpened: "2026-09-24"
dateStarted: "2026-09-24"
dateResolved: "2026-09-24"
tags: []
---

# we: mechanical hung-session detection axis closes the completion-record self-report gap (#3383)

Live 2026-09-24: chalbert/web-everything PRs #2599/#2596/#2594/#2588/#2587/#2582 stayed frozen as
`live-process`/bound because their review sessions' completion records never left `status: started` —
`we:skills-src/review/review-agent-brief.md`'s "report done on infra failure" is prose, and a crashing agent
can skip it. Adds a THIRD, mechanical axis — a session's own transcript file gone stale
(`we:scripts/conveyor/hung-session.mjs`, shared by `we:scripts/conveyor/reconcile-core.mjs#markHungSessions`
and `we:scripts/conveyor/session-reaper.mjs`'s new axis) — that never depends on the agent self-reporting,
frees the PR from `live-process`, and reaps the session even when `state: 'working'` (overriding
`neverReapWorking`, since the whole point is disproving that very state).

## Done when

1. **Executable** — `npx vitest run we:scripts/conveyor/__tests__/hung-session.test.mjs` and
   `npx vitest run we:scripts/conveyor/__tests__/reconcile-core.test.mjs` and
   `npx vitest run we:scripts/conveyor/__tests__/session-reaper.test.mjs` all carry cases that fail on
   `origin/lane/4074-reconcile-daemon-self-sync-gap` (no `we:scripts/conveyor/hung-session.mjs`, no
   `markHungSessions`, no `hungFor` axis) and pass after this item lands.
2. **Live-grounded** — `node we:scripts/conveyor/reconcile-pass.mjs` against the real `chalbert/web-everything`
   repo stops refusing PR #2599/#2596/#2594/#2588/#2587/#2582 as `live-process` (their bound sessions'
   completion records are still `status: started` with no self-report ever landing) while PRs whose sessions
   are genuinely still working (measured: #2607, #2602) still refuse.
