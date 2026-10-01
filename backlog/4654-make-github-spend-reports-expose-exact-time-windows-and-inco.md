---
bornAs: xmjz7ex
kind: story
size: 3
status: resolved
scope: ["we:scripts/lib/gh-spend.mjs", "we:scripts/lib/__tests__/gh-spend.test.mjs"]
dateOpened: "2026-09-30"
dateResolved: "2026-09-30"
tags: []
---

# Make GitHub spend reports expose exact time windows and incomplete coverage

The hours option selects UTC clock hours, not a trailing duration, and reporting can read a bounded tail or an earlier persisted row. Add explicit interval bounds and coverage so a partial-hour or truncated report cannot be treated as a full installation-budget measurement.

## Evidence and fix design

See we:reports/2026-09-30-unmetered-app-graphql-spend.md. we:scripts/lib/gh-spend.mjs:449 floors the hours filter to a UTC hour, reads at most 16 MiB of unconsumed live data, and prefers persisted rows. Its now parameter does not exclude future records, so it cannot replay a historical interval by itself. A report labelled last 1h can therefore be mistaken for the preceding 60 minutes. The supplied 488-point output cannot be reconstructed without its invocation time, section, and log source.

Expose exact start/end, clock-hour versus trailing semantics, read coverage, reset baselines, and persisted/live provenance. Add a bounded explicit interval mode that filters both edges and keeps the needed preceding baseline. Detect/report unread bytes and incomplete coverage instead of presenting missing observations as complete zero spend. Preserve existing hourly storage compatibility.

## Done when

1. At 18:48Z, tests distinguish current clock hour from 17:48–18:48Z and exclude records beyond an explicit end.
2. A log exceeding the tail limit reports incomplete coverage; persisted/live overlap and late appends cannot silently claim a complete window.
3. Report output identifies log source and exact interval, with unknown versus observed zero kept distinct. Tests pin reset crossings and baseline handling.

## Follow-ups

Run we:scripts/lib/__tests__/gh-spend.test.mjs and we:scripts/verify-lane.mjs. Compare a full-file interval replay to the report before making points/hour claims. Filed unqueued for review; no reporting implementation changed in this diagnosis.


Implementation evidence (2026-09-30): we:scripts/lib/gh-spend.mjs accepts explicit half-open start/end bounds, replays raw records with preceding baselines, and exposes exact UTC bounds, log sources, skipped/unread bytes, reset windows, stale observations, and persisted/live provenance. Raw overlap is recomputed, including late appends; explicit partial intervals never substitute whole persisted hours. Legacy hourly storage remains readable. Tests in we:scripts/lib/__tests__/gh-spend.test.mjs compare bounded interval output against a full synthetic replay, pin reset crossings and observed-zero versus unknown, and exercise truncation and old rows. A real CLI replay for [2026-09-30T17:48:00Z, 2026-09-30T18:48:00Z) selected two synthetic records, excluding the end and later records, with two observed counter points and zero attributed caller cost. These are fixture observations, not production points/hour claims.

Validation: the affected spend/auth/throttle/runner/health-watch suites pass (413 tests, six existing skips); the additional CLI provenance regression and all 11 budget-smell tests also pass. The full `npm run check:standards` passes with zero errors and 4542 warnings. `node we:scripts/verify-lane.mjs` cannot create its marker under we:.git in this sandbox (EPERM); its supported `run` mode executes the wider selection. Ten unrelated failures reproduce on an unchanged HEAD snapshot: two caller-detection cases in we:scripts/lib/__tests__/gh-app-shim.test.mjs, one scorecard case in we:scripts/lib/__tests__/antigravity-judge-spawn.test.mjs, the socket case in we:scripts/operations/__tests__/http-adapter.test.mjs, and six process-table cases in we:scripts/operations/__tests__/restart-runner-io-real.test.mjs and we:scripts/operations/__tests__/clear-stuck-session-io-real.test.mjs. A separate local-listen probe confirms EPERM. No gate or unrelated test was weakened.

The wider selection completed: 304 files passed, eight failed, one skipped. Its eight in-scope assertion failures were corrected through provenance-bearing fixtures or the new legacy-cost contract and passed focused reruns; the ten remaining failures reproduced on unchanged HEAD. The final changed-file standards check also passed with zero errors.
