---
kind: story
size: 3
tier: pinned
status: open
dateOpened: "2026-09-29"
tags: []
---

# Builder tick never blocks on an infra-blocked retry's CI wait

Every build-dispatch-daemon tick calls we:scripts/conveyor/infra-blocked.mjs retry synchronously via cliRetryInfraBlocked's execFileSync at we:skills-src/conveyor/build-dispatch-daemon.mjs:460, invoked from runBuildDispatchTick at we:skills-src/conveyor/build-dispatch-daemon.mjs:246-247. That retry pass can itself call we:scripts/pr-land.mjs --label-on-green, which blocks waiting for CI to go green. So one PR's slow CI wait stalls the daemon's ENTIRE tick (dispatch, liveness, claims), not just the retry. Live evidence (2026-09-29, 2:55pm ET): launchd com.we.build-dispatch-daemon (pid 77087, clone ~/workspace/wev-control) wrote its last tick line at 18:22:56Z then produced no tick for 30+ minutes; its child node we:scripts/conveyor/infra-blocked.mjs retry had run 26 minutes, itself waiting 14 minutes on we:scripts/pr-land.mjs --ref=lane/xkqiewd-prevention-card ... --label-on-green. Log: ~/workspace/.operations/coordination/build-dispatch-daemon.log.

## Design / MVP

Two candidate fixes; either clears the MVP bar:

(a) **Detach the retry.** Kick off we:scripts/conveyor/infra-blocked.mjs retry with its own lease file instead of `await`ing it inline in the tick. The tick checks the lease ("still running?") instead of blocking on the child, and proceeds regardless. The existing #2659 label-on-green resume path still finishes the retry later, on its own clock.

(b) **Bound the call.** Keep it inline, but give `cliRetryInfraBlocked`'s `execFileSync` (we:skills-src/conveyor/build-dispatch-daemon.mjs:460) a `timeout` short enough that a slow we:scripts/pr-land.mjs `--label-on-green` CI wait can't consume a whole tick. A timed-out retry is simply retried next tick — idempotent, matching #2659's own backoff design; no new lease machinery.

Recommend (b) first: smallest diff, reuses `execFileSync`'s own `timeout` option, decouples tick cadence from PR CI latency immediately. (a) is the natural follow-up if a bound alone doesn't fully separate the two.

## Test plan

- Unit: a we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs case with an injected `exec`/`retryInfraBlocked` that sleeps far longer than the bound — assert `runBuildDispatchTick` returns within budget, not that the retry itself finishes.
- Regression: the existing build-dispatch-daemon test suite stays green.

## Proof plan

Soak break, before/after on the real mechanism (no manual fix to the live daemon): inject a fake `retryInfraBlocked` that sleeps 5x the daemon's tick interval. BEFORE the fix, the tick hangs past its interval — this reproduces tonight's live symptom (com.we.build-dispatch-daemon, pid 77087, stalled 30+ minutes behind a 14-minute `pr-land --label-on-green` CI wait nested inside a 26-minute retry call). AFTER the fix, the tick still completes within its normal interval, with the slow retry left to finish (or get retried) outside the tick's own critical path.

## Follow-ups

- If (b) ships first, file (a) — detached retry with its own lease — separately, so a persistently-slow CI wait doesn't just retry-and-timeout every tick indefinitely.
- Audit whether this daemon's other shelled per-tick passes have the same synchronous-block exposure (not fixed here).

## Done when

1. **Executable** — a we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs case asserting `runBuildDispatchTick` (or `cliRetryInfraBlocked`) returns within the daemon's tick budget when the retry call would otherwise block past it — fails today (the `await effects.retryInfraBlocked()` call at we:skills-src/conveyor/build-dispatch-daemon.mjs:247 has no bound), passes once (a) or (b) lands.
2. Live proof per the Proof plan above: a before/after soak showing a slow-retry tick no longer stalls the whole tick.
3. `npm run check:standards` and the daemon's own test suite are green.
