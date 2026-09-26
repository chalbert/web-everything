---
bornAs: x5wbsbc
kind: story
size: 8
parent: "4075"
status: active
scaffoldedBy: "xsmokefb"
dateScaffolded: "2026-09-26"
scope: ["we:scripts/lib/daemon-rebuild.mjs", "we:scripts/lib/daemon-live-smoke.mjs", "we:scripts/lib/main-staleness.mjs", "we:scripts/lib/daemon-last-good.mjs", "we:scripts/conveyor/health-smells/daemon-held-on-last-good.mjs", "we:scripts/conveyor/health-watch.mjs", "we:scripts/conveyor/soak/breaks/"]
dateOpened: "2026-09-26"
tags: []
---

# Daemon rebuild: failed smoke falls back to last-good instead of blocking delivery; candidate smoke env matches live

Every daemon rebuild since #2731 (we:scripts/lib/daemon-rebuild.mjs off-lock candidate smoke) is sticky smoke-rejected because the disposable candidate worktree runs we:scripts/lib/daemon-live-smoke.mjs with a broken environment (lane pool root resolved relative to the candidate, repo profile resolved from checkout path, PATH missing, gh timeout). Fix: (1) the candidate smoke env matches the live daemon (explicit LANE_POOL_ROOT, PATH, HOME, WE_*/GH App env, explicit repo identity, gh timeout parity); (2) operator decision: on smoke failure retry plain main without non-pinned overlays and adopt+drop the bad overlay; else stay on the last-good build and keep dispatching - the stale-main refusal (we:scripts/lib/main-staleness.mjs assertMainNotStale) must not fire while on a recorded last-good build, bounded by a max age after which it alerts but still dispatches; a failure identical on plain main is smoke-harness-broken and never blocks; (3) health-watch sign daemon-held-on-last-good >15 min notifies the operator naming failing checks; (4) soak scenarios bad-overlay and broken-harness.

## Root cause (measured live, 2026-09-26)

- `lane-acquire-release` ("no lanes provisioned … under ~/.claude/daemon-self-sync-state/.lanes"): the candidate
  worktree lives under the rebuild state dir, and `we:scripts/lib/lane-pool-paths.mjs#defaultPoolRoot` derives the
  pool from the checkout's own location. Reproduced from a lane with the pre-fix env; passes with
  `candidateSmokeEnv` (explicit `LANE_POOL_ROOT` + `WE_DISPATCH_CWD_ROOT` resolved from the LIVE clone).
- `spawn git ENOENT` / `no repo profile/gate resolved for "we"` (16:19 UTC only): NOT a PATH or profile bug. The
  review and fix daemons share the clone and both smoked the SAME fixed candidate path concurrently (smokes of
  167 s and 72 s overlapping); the first to finish removed the worktree under the second. Fixed by #2731's
  single-flight build lease (`rebuild-in-progress`, unique candidate path per lease), merged into this branch;
  the whole fallback (candidate, plain main, last-good control) runs under that one lease.
- Also resolves #2731's card `4218` (this branch carries all of #2731, including its review fix 85223ccbf).
- `gh-pr-list` 30 s timeout: same window, two concurrent smokes; budget is unchanged from the old smoke (30 s).

## Design

- Fallback (operator ruling): candidate fails → (a) plain main + pinned overlays only; passes → adopt, drop the
  non-pinned overlay(s) (`overlay-dropped-smoke-failed`); (b) else stay on the last-good build, `state.held`
  recorded, and `we:scripts/lib/main-staleness.mjs#assertMainNotStale` dispatches from a managed clone whose HEAD
  is its adopted build (clean tree) instead of refusing — ALERT line past 24 h
  (`WE_DAEMON_LAST_GOOD_MAX_AGE_MS`), never a refusal; (c) a control smoke of the last-good build failing the
  same checks = `smoke-harness-broken` (retry backoff, not re-smoked per main move until due).
- Health sign `daemon-held-on-last-good`: held > 15 min → notify (`notifyEvenInShadow`), naming failed checks.

## Done when

1. **Executable** — `npx vitest run we:scripts/lib/__tests__/daemon-rebuild-fallback.test.mjs we:scripts/lib/__tests__/daemon-last-good.test.mjs` (red on the #2731 base, green here) and the two soak breaks `bad-overlay-falls-back` / `broken-smoke-harness-holds-last-good`.
