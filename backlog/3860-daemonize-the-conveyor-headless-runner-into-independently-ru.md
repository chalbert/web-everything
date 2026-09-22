---
bornAs: x7dch25
kind: story
size: 3
parent: "3383"
status: open
scope: ["we:scripts/conveyor/reconcile-pass.mjs", "we:scripts/conveyor/parked-pr-conflict-watch.mjs", "we:scripts/conveyor/parked-pr-progress-watch.mjs", "we:scripts/conveyor/duplicate-pr-watch.mjs", "we:scripts/conveyor/reconcile-fix-dispatch.mjs", "we:scripts/lib/gh-throttle.mjs"]
dateOpened: "2026-09-21"
tags: []
relatedReport: reports/2026-09-22-backlog-split-analysis.md
---

# Daemonize the conveyor headless runner (umbrella) — this slice: route 5 raw gh calls through we:gh-throttle.mjs

Umbrella for splitting we:skills-src/conveyor/runner.mjs into independently-runnable daemon processes under epic #3383 — see the split analysis (we:reports/2026-09-22-backlog-split-analysis.md) for the full design and the 3-round jury review + code audit it rests on. This card is resized to its own core slice per the split; the rest are siblings under #3383:

- #xxqa08p — key we:skills-src/conveyor/runner-lock.mjs's lease
- #xm5rdrn — extract assertMainNotStale into a shared freshness helper
- #x1yfzce — extract the Fix-dispatch daemon
- #x3fixx3 — build we:pass-daemon.mjs + the daemon manifest schema
- #xt6vu5s — extract the Verify daemon (blocked by #xxqa08p)
- #xwnbft5 — extract the Review daemon (blocked by this card, #3860)
- #xkpma5b — wire the 8 watcher passes onto we:pass-daemon.mjs (blocked by #x3fixx3)
- #xktw9vz — build the Supervisor manifest launcher (blocked by #x3fixx3)
- #x5ljiz4 — decide the credential/token scoping model (kind: decision, carved out per the split rubric — not a build slice, blocks nothing above)

**This slice:** we:scripts/conveyor/reconcile-pass.mjs:85, we:scripts/conveyor/parked-pr-conflict-watch.mjs:236,280,297,321, we:scripts/conveyor/parked-pr-progress-watch.mjs:276,293,311,323, we:scripts/conveyor/duplicate-pr-watch.mjs:239,257, and we:scripts/conveyor/reconcile-fix-dispatch.mjs:187,259 all default an injectable exec parameter to raw execFileSync instead of we:scripts/lib/gh-throttle.mjs's execFileSyncThrottled (confirmed cross-process-safe, already proven at we:scripts/conveyor/ci-queue-watch.mjs:48,189 — same call signature). Swap each default; no behavior change beyond going through the shared rate-limit cap. Independent of every sibling slice — no blockers either direction.

## Done when

1. **Executable** — `grep -n "exec = execFileSync[,}]" we:scripts/conveyor/reconcile-pass.mjs we:scripts/conveyor/parked-pr-conflict-watch.mjs we:scripts/conveyor/parked-pr-progress-watch.mjs we:scripts/conveyor/duplicate-pr-watch.mjs we:scripts/conveyor/reconcile-fix-dispatch.mjs` finds nothing (every default now reads exec = execFileSyncThrottled), each file imports execFileSyncThrottled from we:scripts/lib/gh-throttle.mjs, and each file's existing test suite still passes.
