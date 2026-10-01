---
kind: story
size: 2
status: open
scope: ["we:scripts/progress-board.mjs"]
dateOpened: "2026-09-30"
tags: []
---

# Pin why a conflicting PR can read `queued` in `classifyPr`

Diagnosis: `we:reports/2026-09-30-conflicting-prs-nobody-owns.md`. `classifyPr` in `we:scripts/progress-board.mjs` returns `conflicted` for `DIRTY`/`BEHIND` before it reaches `review:accepted` → `queued`, so a conflicting PR should not read `queued`. Find which input made #3176/#3215 read `queued` (a stale or `UNKNOWN` `mergeStateStatus`, or the queued-conflict grace window in `we:scripts/conveyor/parked-pr-conflict-watch.mjs`) and make the refusal log name it.

## Done when

1. **Executable** — a unit test next to `we:scripts/progress-board.mjs` feeds `classifyPr` a `review:accepted` PR with `mergeStateStatus: 'UNKNOWN'` and asserts the chosen behaviour (`conflicted` or an explicit `unknown` phase, not silent `queued`); it fails before this item lands and passes after.
