---
kind: task
parent: "3383"
status: resolved
scope: ["we:scripts/conveyor/session-reaper.mjs", "we:scripts/conveyor/__tests__/session-reaper.test.mjs", "we:scripts/conveyor/__tests__/session-reaper-cli.test.mjs"]
dateOpened: "2026-09-03"
dateStarted: "2026-09-03"
dateResolved: "2026-09-03"
tags: []
---

# session-reaper must ALSO reap a working/blocked session once its own target item/PR is confirmed done

**Real gap, found live 2026-09-03.** `we:scripts/conveyor/session-reaper.mjs` (WE #3435) only reaped a session
whose `state` read `done`/`failed`. Live: `conveyor-3451`'s target had `status: resolved` and a merged PR
(`chalbert/web-everything#1862`), yet `claude agents` still showed it `state: "blocked"` — untouched by the
old axis. A same-night survey found 17 of 23 non-terminal sessions in this shape. Adds a second, additive reap
axis: a `working`/`blocked` session is ALSO reaped once its own target (derived from its name) independently
confirms done — a resolved backlog item, or a merged PR via one bounded `gh pr view`. Never widens the
original axis, never guesses, never reaps on an unknown signal. Mirrors `we:backlog/3457-*.md`'s dispatch-side
pattern, applied to reap.

## Done when

1. **Executable** — `npx vitest run we:scripts/conveyor/__tests__/session-reaper.test.mjs
   we:scripts/conveyor/__tests__/session-reaper-cli.test.mjs` — both files carry cases that fail against the
   pre-fix code (a `working`/`blocked` session with a `status: resolved` target was never reaped) and pass
   after.
2. Proven live, not just on fixtures: a real `node we:scripts/conveyor/session-reaper.mjs --dry-run --json`
   run against this machine's real `claude agents --json --all` listing correctly plans `conveyor-3451` (and
   the other confirmed-resolved rows) for reap, while never touching a genuinely still-open row
   (`conveyor-2786`, `prepare-3436`, `prepare-3438`, `prepare-3441`, an unmerged `review-*` PR).
