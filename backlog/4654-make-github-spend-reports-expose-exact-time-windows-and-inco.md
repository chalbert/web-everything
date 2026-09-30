---
bornAs: xmjz7ex
kind: story
size: 3
status: open
scope: ["we:scripts/lib/gh-spend.mjs", "we:scripts/lib/__tests__/gh-spend.test.mjs"]
dateOpened: "2026-09-30"
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
