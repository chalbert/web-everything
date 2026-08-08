---
bornAs: xtrts6l
kind: task
status: open
dateOpened: "2026-08-08"
tags: []
---

# burndown data reads UTC while its inputs are operator-local

The burndown data file computes today in UTC but its backlog inputs are stamped in the operator day, so the chart is off by one for part of each day. It is CJS and sits outside the scripts-only day-slice gate.

## Where this came from

Surfaced as a finding on PR #1018 (the #2747 operator-day date stamping work) and left
unfixed there: the file is not in that PR's diff, and fixing it needs plumbing wider than
the PR's scope. Split out so #1018 could land.

## The problem

`we:src/_data/burndown.js:43` computes `sysToday` from a UTC-normalised `Date.now()`.
Since #2747, the backlog dates it charts against are stamped in the **operator's** day.
For the part of each day where the two frames disagree, the chart's idea of "today" is off
by one.

Two reasons it was not simply fixed in #1018:

1. The file is **CommonJS** and the operator-day helper is an ES module
   (`we:scripts/lib/local-date.mjs`). Using it needs a CJS mirror or an interop shim.
2. The #2747 day-slice gate scans `we:scripts/` only, so this file is invisible to it.
   Widening the scan past `scripts/` will flag more CJS files — that is the real cost.

## Severity

Cosmetic. `we:src/_data/burndown.js:46` takes `Math.max(sysToday, lastData)`, so the worst
case is the chart's x-axis extending one day further than it should. No data is wrong, no
gate reds. This is worth doing as part of the shared-helper work, not on its own.

## What to consider

- A CJS mirror of the operator-day helper is the same plumbing
  /backlog/2985-does-the-born-active-ttl-need-a-grace-day-for-operator-timez/ needs, and
  that one has a stronger case. Do them together, or do this one after that ruling lands.
- Widening the day-slice gate past `we:scripts/` is a separate call: it will surface more
  hits, and each needs either a fix or an amnesty marker. Scope that before turning it on.

## Acceptance

- The burndown's "today" is computed in the same day frame as the dates it charts.
- Whatever helper it uses is reachable from CJS without duplicating the date logic.
- If the day-slice gate is widened to cover it, every newly-surfaced hit is either fixed or
  carries a marker with a stated reason.
