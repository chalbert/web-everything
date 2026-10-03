---
bornAs: xbkrtik
kind: story
size: 3
status: open
scope: ["we:scripts/conveyor/soak/breaks/large-queue-slow-already-done.mjs", "we:scripts/conveyor/soak/breaks/large-queue-slow-already-done.soak.test.mjs", "we:scripts/lib/__tests__/child-failure.test.mjs", "we:scripts/lib/child-failure.mjs", "we:scripts/readiness/__tests__/already-done-refresh.test.mjs", "we:scripts/readiness/already-done-refresh.mjs", "we:scripts/conveyor/soak/breaks/already-done-recheck-burst-no-cooldown.mjs", "we:scripts/conveyor/tick-core.mjs", "we:scripts/lib/__tests__/bounded-child.test.mjs", "we:scripts/lib/__tests__/gh-cost-git-paths.test.mjs", "we:scripts/lib/__tests__/gh-throttle.budget-block.test.mjs", "we:scripts/lib/__tests__/pr-snapshot.test.mjs", "we:scripts/lib/bounded-child.mjs", "we:scripts/lib/gh-throttle.mjs", "we:scripts/lib/git-pr-commits.mjs", "we:scripts/lib/pr-limit.mjs", "we:scripts/lib/pr-snapshot.mjs", "we:scripts/readiness/__tests__/dispatch-plan-already-done-bounded-spawn.test.mjs", "we:scripts/readiness/dispatch-plan.mjs", "we:skills-src/conveyor/build-dispatch-daemon.mjs"]
dateOpened: "2026-09-30"
tags: []
---

# Bound builder planning and preserve child failure diagnostics

The builder's last completed tick was 2026-09-30 19:03:55.767Z. The following failures logged only the
command name. The live queue contained roughly 444 clearances. Work is left uncommitted for human review;
the managed builder checkout has not been edited or restarted.

## Diagnosis

- The age-gated enrichment in `we:scripts/readiness/dispatch-plan.mjs` submitted every cache miss to
  `defaultCheckAlreadyDoneAsync`. That helper in `we:scripts/operations/dispatch-lane-io.mjs` actually uses
  synchronous throttled execution. `Promise.all` therefore serialized network work, with no per-tick cap.
  Successful cache entries were written only after the entire sweep: a killed sweep lost all its progress.
- PR #3103 landed as `e8268403c`. Its `we:scripts/lib/git-already-done.mjs` still fetches before answering,
  only remembers successful fetches, and returns unknown even for a matching implementation merge because
  the original PR body can contain a disclaimer that git cannot prove absent. Shallow history, other base
  branches, JIT-number/single-parent matches, and custom merge messages also cause host fallback.
- In the existing host attribution log, 1,101 already-done calls occurred between 19:03:59.096Z and
  19:55:58.859Z: 920 successful; all recorded attempts were attempt 1. This supports serial call volume
  as the observed cause, rather than a claim that retries caused this incident. The throttle also permits
  admission waits and rate-limit backoff; those are possible additional delays, not proven here.
- `we:scripts/conveyor/tick-core.mjs` allows twice `WE_CHILD_TIMEOUT_MS` for the planner: normally 600 seconds.
  No override was present in this lane. The previously reported 25-second failure cannot be diagnosed from
  its truncated message alone. No timeout was raised.
- Both `we:scripts/conveyor/tick-core.mjs` and `we:skills-src/conveyor/build-dispatch-daemon.mjs` discarded
  everything after the first newline of the child error. The planner did the same for its own children; `we:scripts/lib/bounded-child.mjs` also discarded the remaining stderr instead of attaching it to the rejection.
- PR comment reads also exist in `we:scripts/conveyor/tick-core.mjs` after the plan read. Their presence in
  a process snapshot is not proof they came from already-done enrichment.

## Change

The planner reads one local git snapshot and existing verdicts. Unknowns remain visible in its
`groundTruth` output. One exclusive background worker checks at most two unresolved ids, records each
successful result immediately, and rotates attempted ids even on failure. It never blocks the planner.
The existing mandatory pre-launch already-done check remains. Missing PR-body evidence is never invented.

Retries, personal-identity fallback, and extra rate-limit probes are disabled for this worker; known budget
blocks still apply. A separate guardian bounds even synchronous waits and kills the worker process group.
The planner's PR-limit read uses the shared snapshot and local commit facts, and branch drift reads local
notes without fetching. Child diagnostics retain stderr, exit status, and signal through the shared child runner, planner, tick, and daemon.

## Observed verification

The command `node we:scripts/readiness/dispatch-plan.mjs --json` was executed from this lane against the
live conveyor queue, with the same options before and after, an isolated cold cache, and child-process
instrumentation. This sandbox denies network and shared-state writes; these are lane measurements, not
claims of production recovery. The live queue and active lanes continued to change between measurements.

| Measurement | Wall time | GitHub subprocess calls | Git fetch attempts |
| --- | ---: | ---: | ---: |
| Before, fully counted | 45.714 s | 326 | 311 |
| After | 8.103 s | 0 foreground, 2 background | 0 |
| Final diagnostic-preserving version, while the wider test gate ran | 26.559 s | 0 foreground, 2 background | 0 |

An intervening probe failed after 41.392 seconds in the existing shared lane-pool scan; its
`node:fs` diagnostic was the evidence that found the remaining truncation inside the bounded child runner.
That truncation is now fixed. The successful runs above demonstrate the GitHub bound; they do not establish
a fixed runtime for the independently changing shared lane pool.

The new real-CLI soak `we:scripts/conveyor/soak/breaks/large-queue-slow-already-done.mjs` uses 444 stale
items and a fake GitHub executable that takes 2.5 seconds then reports rate exhaustion. The old planner
fails the 2-second observation bound; the fixed planner returned in 484 ms, made two total calls, and
kept an overlapping tick from spawning another worker. Failed checks did not become cached negatives.
The first soak exposed hidden rate-limit probes (four calls); the final bound includes those too.

`npm run check:standards` passed with zero errors. The final supported
`node we:scripts/verify-lane.mjs run` gate (temporary admission pool; git metadata is read-only here)
ran 14,910 tests against the frozen code diff: 14,869 passed, 22 failed, 19 pre-existing skips.
All 22 failures reproduced against unmodified source. They require process-table access, a localhost
socket, or writes to user transcript/drain-lock storage unavailable in this sandbox. The socket refusal
also produced an unhandled `listen EPERM`. No tests were skipped or weakened to hide these failures.
The changed-feature unit tests, daemon logging tests, and both soak tests passed.
The required gate therefore remains RED in this environment, not falsely certified green.

Unit tests cover 444/10,000-item selection, failure rotation, local snapshot sharing, conservative unknowns,
cache replay in both queue populations, bypass/cooldown bounds, and unwritable cache behavior.

## Follow-ups

- Do not equate an async function signature or a concurrency semaphore with a per-tick request budget.
- Count all subprocess calls in a slow/rate-limit soak, including the throttle's diagnostic budget probes.
- Run the supported marker-free lane verification mode when this sandbox refuses writes beneath git metadata;
  keep admission state in a writable temporary pool. This changes neither the selected tests nor standards checks.
- Production recovery must be observed after the human-reviewed change reaches the managed builder.
- The other review debts in `we:backlog/4639-file-the-prevention-guard-s-owed-by-chalbert-web-everything.md`
  remain separate; this fix does not claim that git contains every PR's original metadata.
