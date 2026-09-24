---
kind: story
size: 5
parent: "3383"
status: resolved
scope: ["we:scripts/lane-pool.mjs", "we:scripts/conveyor/lane-pool-health-watch.mjs", "we:scripts/conveyor/__tests__/lane-pool-health-watch.test.mjs", "we:skills-src/conveyor/daemon-manifest.mjs", "we:skills-src/conveyor/__tests__/daemon-manifest.test.mjs", "we:scripts/__tests__/lane-pool-acquire-cache.test.mjs"]
dateOpened: "2026-09-24"
dateStarted: "2026-09-24"
dateResolved: "2026-09-24"
tags: []
---

# lane-pool acquire disagrees with health-watch and stalls under concurrency (#3383 live incident)

LIVE 2026-09-24 ~14:20 ET: review-2582's acquire (we:scripts/lane-pool.mjs) with --wait-ms=30000 took ~6 minutes under 5 concurrent review dispatches and still failed (60 all held/dirty), while we:scripts/conveyor/lane-pool-health-watch.mjs --dry-run read 14-15 acquirable at the same time. Root causes, all confirmed live: (1) we:scripts/conveyor/lane-pool-health-watch.mjs's acquirable count is derived from git status --porcelain (litter-vs-real-dirt) alone and never checks ahead-of-origin state, while the real gate (we:scripts/lane-pool.mjs's isLaneAcquirable/effectiveDirtyOrAhead, shared by acquire and list --acquirable) always checks ahead too — live-verified against the real WE pool: list --acquirable --json returned only 3 real acquirable lanes while health-watch reported 14, the 11 false positives all clean-porcelain but 1-2 commits ahead of origin/main. (2) we:scripts/lane-pool.mjs's own auto-pick loop never reuses the single-flight acquirable-list cache/scan-timeout already built for list --acquirable (#xn432dz); it recomputes the full dirty/ahead probe pipeline for every unleased lane on every poll tick with no per-iteration time bound, so N concurrent acquirers each independently re-scan and --wait-ms does not bound total wall time. (3) we:scripts/conveyor/lease-reaper.mjs is never invoked by any daemon running today: absent from we:skills-src/conveyor/daemon-manifest.mjs's manifest (confirmed by direct read) and absent from we:skills-src/conveyor/review-daemon.mjs's own tick (which wires a DIFFERENT reaper, session-reaper, per #3982 — whose own digest documents this exact orphaning pattern happening to session-reaper before its fix); its only historical caller (we:skills-src/conveyor/runner.mjs's mechanical passes) is retired. No lease-reaper log file exists under the running daemon's own log directory, confirming it never runs live, so any lease its session-gone/ttl-stale axes could reclaim sits held until pure TTL (240min default) elapses. Fix: (a) make health-watch's acquirable count reuse the real list --acquirable answer instead of a porcelain-only approximation; (b) make acquire's auto-pick consume the shared single-flight acquirable-list cache (bounded by a scan-timeout, invalidated on any lease change) instead of an unbounded independent per-lane rescan every poll tick, bounding total time by wait-ms plus one scan budget; (c) register lease-reaper in the daemon manifest (it is repo-agnostic — scans the whole lane-pool root in one process, no --repo needed) so its reap axes run periodically again.

## Progress

Live proof, real production WE lane pool (`~/workspace/.lanes/web-everything`), before landing vs after:
- Eligibility divergence (fix a): `node we:scripts/conveyor/lane-pool-health-watch.mjs --dry-run` read 14 acquirable
  before this fix; `node we:scripts/lane-pool.mjs list --acquirable --json --no-cache` (the real gate) read 3 at
  the SAME moment — an 11-lane overcount, every one clean-porcelain but 1-2 commits ahead of origin/main. After
  this fix, both read the identical answer (verified live: 4 acquirable both ways, pool state having since moved).
- Concurrency/bounded-time (fix b): saturated the real pool to genuinely 0 acquirable (temporarily held its 4 free
  lanes, then released them back — no work discarded), then ran 3 concurrent `acquire --wait-ms=8000` against it.
  BEFORE (unfixed `we:scripts/lane-pool.mjs`, run from the primary checkout): 27.60s wall-clock for all 3 (3.4x
  over budget) — the "the wait doesn't bound the scan" failure, reproduced live. AFTER (this fix): 9.09s (bounded
  to ~wait-ms + one scan budget, matching spec). All 3 callers correctly reported "no free lane" both times (a
  genuinely saturated pool, not a false failure).
- lease-reaper wiring (fix c): confirmed live — no `lease-reaper*.log` exists under the running review-daemon's
  own `.conveyor/` log directory (every other wired pass has one), and `we:skills-src/conveyor/daemon-manifest.mjs`'s
  `DAEMON_MANIFEST` never named it — confirmed by direct read this pass has been uncalled since the daemon split
  (the same fate `we:scripts/conveyor/session-reaper.mjs` had before #3982's fix). 8 live `Mac:<pid>` leases found
  held at the time of this write, ages 52min-1215min — all within reach of the now-wired session-gone/ttl-stale
  axes once a live `we:skills-src/conveyor/pass-daemon.mjs` picks up the updated manifest (not done here — no
  daemon process was started/restarted, per the "never touch daemon clones or launchd" rule).
- Dirty-lane breakdown (item 3, real classification, not applied as a code change this slice — see below):
  of the ~30 unleased dirty lanes at incident time, most carry either substantive uncommitted SOURCE work (e.g.
  lane-3: 18 real source/asset files; lane-17: ~20 files of in-flight action/coordination primitives; lane-15:
  `we:scripts/conveyor/status-board.mjs` + tests) or single scratch backlog-card fixtures — none of these are
  safe to reclassify as reapable litter. A smaller set (`.fix-*.txt/.md/.log` bundles, `.conveyor/`, `tmp/`,
  `.prep-*.md`, `.review-loop-*.log`) LOOK like known-safe agent scratch and are strong candidates to extend
  `we:scripts/lib/lane-litter.mjs`'s allowlist for, but a direct repo-wide search found NO script anywhere that
  writes these exact names (unlike every existing allowlist entry, which cites its real writer) — so their
  provenance could not be confirmed in this slice, and per "never discard anyone's work" they are left alone
  rather than guessed at. Filed as an explicit follow-up rather than silently dropped.

## Done when

1. **Executable** — `node we:scripts/readiness/heavy-admission.mjs run -- npx vitest run --config we:vitest.integration.config.ts we:scripts/__tests__/lane-pool-acquire-shares-scan-cache.test.mjs` passes (3/3): proves auto-pick now shares the single-flight `list --acquirable` scan/cache under concurrent acquirers and bounds total time by `--wait-ms` plus a scan budget (fails red against the pre-fix `we:scripts/lane-pool.mjs`).
2. **Executable** — `npx vitest run we:scripts/conveyor/__tests__/lane-pool-health-watch.test.mjs` passes (58/58): `summarizeHealth`'s new real-`list --acquirable` cross-check narrows a plan-only "already-clean" lane that is really ahead-of-origin down to not-acquirable (fails red against the pre-fix `we:scripts/conveyor/lane-pool-health-watch.mjs`).
3. **Executable** — `npx vitest run we:skills-src/conveyor/__tests__/daemon-manifest.test.mjs` passes (28/28): `DAEMON_MANIFEST` now registers `lease-reaper` (repo-agnostic, no `--repo`), against the real script.
4. **Live** — see the Progress section above: real before/after timing + real acquirable-count agreement on the actual WE lane pool, with everything acquired for the test released back.
