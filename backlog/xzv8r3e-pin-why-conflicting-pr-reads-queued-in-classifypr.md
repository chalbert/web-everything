---
kind: story
size: 2
status: open
scope: ["we:scripts/progress-board.mjs", "we:scripts/conveyor/reconcile-core.mjs"]
dateOpened: "2026-09-30"
tags: []
---

# Pin why a conflicting PR can read `queued` in `classifyPr`

Diagnosis: `we:reports/2026-09-30-conflicting-prs-nobody-owns.md`. `classifyPr` in `we:scripts/progress-board.mjs` returns `conflicted` for `DIRTY`/`BEHIND` before it reaches `review:accepted` → `queued`, so a conflicting PR should not read `queued`. Find which input made #3176/#3215 read `queued` — a stale or `UNKNOWN` `mergeStateStatus`, or `mergeable` and `mergeStateStatus` disagreeing (the queued-conflict grace window is ruled out: it never changes the phase) — and make the `nothing-owed` refusal line in `we:scripts/conveyor/reconcile-core.mjs` name the `mergeStateStatus` and `mergeable` it saw.

## Done when

1. **Executable** — a unit test next to `we:scripts/progress-board.mjs` feeds `classifyPr` a `review:accepted` PR with `mergeStateStatus: 'UNKNOWN'` and `mergeable: 'CONFLICTING'` and asserts the chosen behaviour (`conflicted` or an explicit `unknown` phase, not silent `queued`); it fails before this item lands and passes after.
2. **Executable** — a unit test on the `nothing-owed` refusal in `we:scripts/conveyor/reconcile-core.mjs` asserts the logged refusal carries both the `mergeStateStatus` and `mergeable` values the pass saw; it fails before this item lands and passes after.
