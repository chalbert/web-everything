---
bornAs: x7dch25
kind: story
size: 3
parent: "3383"
status: resolved
scope: ["we:scripts/conveyor/reconcile-pass.mjs", "we:scripts/conveyor/parked-pr-conflict-watch.mjs", "we:scripts/conveyor/parked-pr-progress-watch.mjs", "we:scripts/conveyor/duplicate-pr-watch.mjs", "we:scripts/conveyor/reconcile-fix-dispatch.mjs", "we:scripts/lib/gh-throttle.mjs"]
dateOpened: "2026-09-21"
dateStarted: "2026-09-22"
dateResolved: "2026-09-22"
tags: []
relatedReport: reports/2026-09-22-backlog-split-analysis.md
---

# Daemonize the conveyor headless runner (umbrella) — this slice: route 5 raw gh calls through we:gh-throttle.mjs

Umbrella for splitting we:skills-src/conveyor/runner.mjs into independently-runnable daemon processes under epic #3383 — see the split analysis (we:reports/2026-09-22-backlog-split-analysis.md) for the full design and the 3-round jury review + code audit it rests on. This card is resized to its own core slice per the split; the rest are siblings under #3383:

- #3877 — key we:skills-src/conveyor/runner-lock.mjs's lease
- #3875 — extract assertMainNotStale into a shared freshness helper
- #3870 — extract the Fix-dispatch daemon
- #3871 — build we:pass-daemon.mjs + the daemon manifest schema
- #3878 — extract the Verify daemon (blocked by #3877)
- #3876 — extract the Review daemon (blocked by this card, #3860)
- #3873 — wire the 8 watcher passes onto we:pass-daemon.mjs (blocked by #3871)
- #3874 — build the Supervisor manifest launcher (blocked by #3871)
- #3872 — decide the credential/token scoping model (kind: decision, carved out per the split rubric — not a build slice, blocks nothing above)

**This slice, as filed:** we:scripts/conveyor/reconcile-pass.mjs, we:scripts/conveyor/parked-pr-conflict-watch.mjs, we:scripts/conveyor/parked-pr-progress-watch.mjs, we:scripts/conveyor/duplicate-pr-watch.mjs, and we:scripts/conveyor/reconcile-fix-dispatch.mjs were all cited (against `origin/lane/mechanical-dispatcher`) as defaulting an injectable exec parameter to raw execFileSync on a `gh`-calling function, instead of we:scripts/lib/gh-throttle.mjs's execFileSyncThrottled.

## Progress

`main` had already independently fixed 2 of the 5 cited files by the time this was worked (we:scripts/conveyor/reconcile-pass.mjs's `defaultReadPrs` and all of we:scripts/conveyor/duplicate-pr-watch.mjs were already throttled — drift from the prototype-branch snapshot the card was filed against). Re-verified against `main`'s actual current code before editing: only 3 functions across 3 files still called `gh` through a raw, unthrottled default —
- we:scripts/conveyor/parked-pr-conflict-watch.mjs `defaultListPrFiles`
- we:scripts/conveyor/parked-pr-progress-watch.mjs `defaultListLabelEvents`
- we:scripts/conveyor/reconcile-fix-dispatch.mjs `fetchPrDiffScope` (needed the `execFileSyncThrottled` import added; the other two files already had it)

Every OTHER `exec = execFileSync` default remaining in these 5 files (we:scripts/conveyor/reconcile-pass.mjs `defaultReadAgents`/`resolveLaneHead`, we:scripts/conveyor/parked-pr-progress-watch.mjs `defaultListAllAgents`/`defaultPostFinding`, we:scripts/conveyor/parked-pr-conflict-watch.mjs `defaultPostConflictFinding`/`defaultPostConflictStandDown`/`defaultPostConflictRearm`, we:scripts/conveyor/reconcile-fix-dispatch.mjs `freeLaneNumbers`, we:scripts/conveyor/duplicate-pr-watch.mjs `defaultPostFinding`) calls `claude`, `git`, or `node` — never `gh` — so it correctly stays on raw execFileSync; gh-throttle is scoped to the `gh` binary only, not a blanket exec replacement.

## Done when

1. **Executable** — `defaultListPrFiles` (we:scripts/conveyor/parked-pr-conflict-watch.mjs), `defaultListLabelEvents` (we:scripts/conveyor/parked-pr-progress-watch.mjs), and `fetchPrDiffScope` (we:scripts/conveyor/reconcile-fix-dispatch.mjs) each default `exec` to `execFileSyncThrottled` imported from we:scripts/lib/gh-throttle.mjs; `grep -n "exec('gh'" -B3` on each of the 5 originally-cited files shows every `gh`-calling function using that default; each file's existing test suite still passes (verified: 152/152 across the 3 changed files' suites).
