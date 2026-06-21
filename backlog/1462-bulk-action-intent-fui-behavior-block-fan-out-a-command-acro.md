---
kind: story
size: 5
status: resolved
blockedBy: ["1423"]
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: "we:src/_data/intents/bulk-action.json"
tags: []
---

# bulk-action intent + FUI behavior block — fan-out a command across an N-item selection (scope: visible|matching, count-announce, partial-failure outcome)

Realizing build for the #1423 placement ruling: author the bulk-action intent JSON (scope: visible|matching default visible; the fan-out + N-selected aria-live count + post-action focus-return contract; the per-target partial-failure outcome) composing selection + command over a target set, plus the FUI behavior block that realizes it (consumes existing SelectionBehavior + the #1409 toolbar bar, binds the bar to the live selection set) and a demo (selectable list with contextual action bar). File via /new-standard. Apply/rollback mechanics delegate to a future #1395-style optimistic-mutation home; bulk-action only names the partial-failure contract.

## Progress (batch-2026-06-21)

- **WE intent** `we:src/_data/intents/bulk-action.json` (status active) — dimensions `scope`
  (visible|matching, default visible, accident-protected) + `onPartialFailure` (continue-and-report |
  abort-on-first); description names the residual it owns (fan-out across the live selection, the
  `matching` predicate, per-target partial-failure, the "N selected" aria-live count, post-action focus
  return) and the compose-Selection+Command boundary; apply/rollback delegated to #1395.
- **FUI behavior block** `fui:blocks/bulk-action/bulkAction.ts` (+ `fui:blocks/bulk-action/index.ts`):
  pure `fanOut(targets, action, {onPartialFailure})` engine (the partial-failure contract, DOM-free) +
  `createBulkActionBar` binding a contextual bar to a live selection set — shows the `aria-live` count,
  fans the command out, reports per-target outcome, returns focus to an anchor. Registered in
  `fui:src/_data/blocks.json`.
- **Demo** `fui:demos/bulk-action-demo.html` — a selectable list + contextual action bar with an
  Archive action and a "Fail evens" partial-failure demonstrator. Verified live on :3001: bar
  hidden→shown on selection, "3 selected" count, partial failure reports "1 done, 2 failed".
- 5 unit tests `fui:blocks/__tests__/unit/bulk-action/bulkAction.test.ts` (continue-and-report,
  abort-on-first, async, count binding, fan-out + focus return). WE intent page (gen:inventory regen);
  WE + FUI `check:standards` → 0 errors; typecheck clean.
