---
type: issue
workItem: task
status: resolved
dateOpened: "2026-06-07"
dateStarted: "2026-06-07"
dateResolved: "2026-06-07"
tags: [backlog, burndown, data-quality, dateResolved]
crossRef: { url: /backlog/, label: Backlog burndown tab }
---

# 26 backfilled `dateResolved` values are git-inferred, not exact

When the burndown was introduced, 26 already-`resolved` items had no `dateResolved`. They were
backfilled programmatically from the **git last-commit date** of each item's file (and two —
`#151`, `#162` — fell back to `dateOpened` because the file was uncommitted at the time). These are
**approximations of the real resolution moment**, good enough for the burndown's trend/rate/projection
but not authoritative.

This matters only if someone later treats those specific dates as precise (e.g. fine-grained velocity
analysis on the early period). Going forward the gap closes itself: `docs/agent/backlog-workflow.md`
now **requires** `dateResolved` at close-out and `check:standards` errors without it, so newly-resolved
items carry an exact date.

- If precision is ever needed, reconcile the 26 against the actual commit that flipped each to
  `status: resolved` (`git log -S'status: resolved' -- backlog/<id>.md`), or accept the commit-date
  proxy and close this.
- The affected items resolved across 2026-06-06 / 2026-06-07 — the cluster where most of the backlog
  was opened and burned down, so the proxy is within a day of truth in every case.

Acceptance: either the 26 dates are confirmed/corrected against git history, or this is closed as
"commit-date proxy accepted" — no change required, just a recorded decision.

## Resolution — commit-date proxy accepted

Closed via the second acceptance path: **accept the commit-date proxy; no dates changed.** Rationale:

- **Low value.** The proxy is within a day of truth in every case (all 26 resolved across
  2026-06-06 / 2026-06-07), and precision only matters for fine-grained velocity analysis on the
  early period — not a current need. The burndown's trend/rate/projection are unaffected.
- **Reconciliation isn't reliable right now anyway.** Exact reconciliation depends on
  `git log -S'status: resolved' -- backlog/<id>.md` finding the commit that flipped each item. At
  close-out time **all 57 resolved items are uncommitted** in the working tree, so the flips aren't
  in history yet — a git-inferred "exact" date would be no more authoritative than the proxy.
- **The gap is self-closing.** `docs/agent/backlog-workflow.md` now requires `dateResolved` at
  close-out and `check:standards` errors without it, so every newly-resolved item carries an exact
  date. The 26 backfilled values are a one-time bootstrap artifact, not an ongoing source of drift.

If fine-grained early-period velocity is ever needed, reopen and reconcile against history once the
branch is committed.
