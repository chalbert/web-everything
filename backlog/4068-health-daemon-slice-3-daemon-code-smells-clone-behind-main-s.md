---
bornAs: xd9lp7o
kind: story
size: 5
parent: "4075"
status: active
blockedBy: ["4065"]
scope: ["we:scripts/conveyor/health-smells/"]
dateOpened: "2026-09-24"
dateStarted: "2026-09-29"
tags: []
---

# Health daemon slice 3: daemon-code smells — clone behind main, self-sync conflict, smoke-gate failure, stale live-process bindings, drain pass over budget

Third slice of 4065: add the daemon-code smells seen on 2026-09-24 to the registry built in slice 1: a daemon clone behind origin/main or its self-sync in conflict (we:scripts/lib/daemon-self-sync.mjs), live smoke gate failures (we:scripts/lib/daemon-live-smoke.mjs), sessions bound as live-process whose transcripts are stale, and the drain's pass duration over budget or merges per hour dropping.

## Done when

1. **Executable** — each new smell has a fixture-driven unit test (breach and clean samples) through the
   slice-1 core; the suite fails before this lands.
2. **Live proof** — each smell's probe runs against the live fleet in `shadow` and its reading is shown in
   the episode report or HEALTH section.

## Progress

- **Already covered before this slice (no new smell):** clone behind origin/main and live smoke-gate failure —
  `clone-stale` (held/rejected/`smoke-rejected` with the failing check) and `daemon-held-on-last-good` (frozen on
  the last-good build after a failed smoke), both pulled forward from slice 1 / x5wbsbc.
- **New smells** (we:scripts/conveyor/health-smells/):
  - `self-sync-conflict` — `daemon-self-sync: … behind … but NOT syncing (conflict|dirty|not-on-branch)` lines in
    a daemon's log since the last tick (plain + POC shapes), and a recent `pinned-overlay-conflict` rebuild alert.
  - `live-process-stale-transcript` — a PR the reconcile pass refuses `live-process` this tick (its own log line)
    whose freshest binding has been idle ≥45m. Bindings = live review-job records (activity = the job's own
    files' newest mtime — the reconcile pass never reads a job's activity, only its pid) + PR-bound sessions
    (`fix-`/`ci-heal-`/`review-<pr>`, transcript age via `readHungInfo`). `conveyor-`/`prepare-` names end in a
    backlog number, not a PR, and are excluded. Nothing readable → clean, never guessed stale.
  - `drain-pass-over-budget` — ≥2 drain passes over 3m in the last 30m, or the latest over 9m (live p99 is 69s).
  - `drain-merge-rate-drop` — last-hour merges ≤25% of the prior-6h hourly rate (baseline ≥1/h, history must
    cover it) while ≥3 recent passes considered PRs and landed none.
- **Probes** (we:scripts/conveyor/health-watch.mjs): `drainHistory` (every tick, the drain's `history.jsonl`;
  `--drain-history` fixture flag; a `--lock-root` fixture tick never reads the host file) and `liveBindings` (gh
  cadence, with the `agents` listing — read-only, never prunes a job record). `probeAgents` now carries `pid`.
- **Tests:** we:scripts/conveyor/health-smells/__tests__/slice-3-daemon-smells.test.mjs — breach + clean fixtures
  for each smell through `runHealthTick`, the probes against on-disk fixtures, and a fixture `tick()` opening
  `self-sync-conflict` + `drain-pass-over-budget` through the real registry.
- **Live proof (2026-09-29, read-only, shadow config, fresh state):** drain — 5 merges last hour vs 2.2/h
  baseline, 0 of 22 passes over budget (clean); self-sync — no conflict lines/alerts (clean); live-process — 10
  PRs refused `live-process` in the log tail, none with a live binding left (clean), and the 31 zombie
  `working` listing rows (silent for weeks) correctly NOT flagged since none holds a refused PR.
