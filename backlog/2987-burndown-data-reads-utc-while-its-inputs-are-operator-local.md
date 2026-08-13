---
bornAs: xtrts6l
kind: task
status: open
dateOpened: "2026-08-08"
tags: []
scope:
  - we:src/_data/burndown.js
  - we:src/_data/__tests__/burndown.test.ts
  - we:scripts/lib/
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

## Scope notes (prepare-scope pass, #2987)

`scope:` above predicts: the fix itself (`we:src/_data/burndown.js`), its accounting-invariant test
(`we:src/_data/__tests__/burndown.test.ts`, likely extended with a day-frame regression case), and
`we:scripts/lib/` — the operator-day helper (`we:scripts/lib/local-date.mjs`) plus whatever CJS-reachable
mirror/shim the fix adds next to it (exact new filename not predictable ahead of the build, so the directory
is named rather than guessed), and that helper's own test under `we:scripts/lib/__tests__/`.

Consumers of `we:src/_data/burndown.js`'s OUTPUT considered and deliberately left OUT of scope:

- `we:src/backlog.njk:656-714` — embeds `burndown.*` fields (points, rates, `clearDateFrozen`/`clearDateNet`,
  the full `burndown | dump | safe` JSON) as-is. It does no date computation of its own, so once the upstream
  data is correctly bucketed, this template needs no edit.
- `we:src/assets/js/backlog-burndown.js:88` (`fmtDate`) and `:124-161` (axis ticks, the "today" marker) —
  parses each `YYYY-MM-DD` string via `Date.parse` (ISO date-only ⇒ UTC midnight) and formats back with
  `getUTCMonth`/`getUTCDate`. That parse↔format round-trip is UTC-anchored ARITHMETIC on an already-decided
  calendar day, not a wall-clock read — the same exemption shape `we:scripts/lib/utc-day-slice-scan.mjs`'s
  docblock describes for date-only arithmetic. Once `we:src/_data/burndown.js` computes `today` in the
  operator frame, this file renders it correctly with no change; it was the likeliest place a stale-frame
  LABEL could survive the fix (the "statistic computed over one population, label describes the other"
  trap), and it does not.
- `we:src/_data/backlog.js` — upstream producer of `dateOpened`/`dateResolved`, already operator-local since
  #2747 (unquoted-YAML-date guard aside, out of this item's scope). Not a downstream consumer of the fix.
- No persisted artifact and no separate published board: unlike `we:reports/app-conformance-burndown.json`
  (a same-named but unrelated "burndown" for app conformance, driven by `we:scripts/check-app-conformance.mjs`),
  the `/backlog/` burndown has no on-disk log — it is computed at build time and embedded straight into the
  one `/backlog/#burndown` tab. Propagation is confined to that single chart; nothing else reads this data.
- The day-slice gate widening past `we:scripts/` (`we:scripts/check-standards.mjs`,
  `we:scripts/lib/utc-day-slice-scan.mjs`) is explicitly deferred by the card's own "What to consider"
  section above — a separate call, not part of this item's build.

## Acceptance

- The burndown's "today" is computed in the same day frame as the dates it charts.
- Whatever helper it uses is reachable from CJS without duplicating the date logic.
- If the day-slice gate is widened to cover it, every newly-surfaced hit is either fixed or
  carries a marker with a stated reason.
