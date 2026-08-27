---
bornAs: xvdhiro
kind: story
size: 3
parent: "3318"
status: resolved
dateOpened: "2026-08-26"
dateResolved: "2026-08-27"
tags: [review, ledger, delivery]
scope:
  - we:scripts/lib/verdict-ledger.mjs
  - we:scripts/review-ledger-check.mjs
---

# A non-bearing `observed` verdict so a review can be recorded without holding the merge

The verdict ledger's closed set has no value that neither clears nor holds, so an advisory review has no
honest verdict to record. Add `observed` — recorded, never bearing on the merge — as the sixth value, on the
`RESTAMPED` precedent.

Required by [`#every-pr-gets-a-look-advisory-floor`](../docs/agent/platform-decisions.md#every-pr-gets-a-look-advisory-floor);
`#3330` is the pass that writes these rows and is blocked on this.

## Why the existing values will not do

`VERDICTS` (`we:scripts/lib/verdict-ledger.mjs`) is closed and **total**: every member is in `CLEARING` or is
a hold. An advisory sanity check fits neither.

- **`accepted` is a lie and a measurement bug.** Nothing was accepted — a tool-free diff-read is not a
  clearance — and a reader counting acceptances would count it. That is exactly the miscount `RESTAMPED` was
  added to prevent, and its comment already argues this case: *"it is deliberately NOT `ACCEPTED`: no review
  was run, and a reader counting acceptances must not count this as one."* Same reasoning, new value.
- **`changes` holds**, which is the merge-blocking this whole ruling exists to avoid.

## The trap in `foldVerdictLedger`

`foldVerdictLedger` assigns `entry.current = r` and `entry.clears = r.clears` for **every** row — last row
wins — and then treats every non-clearing row after the last clear as an outstanding hold. So an `observed`
row appended **after** an `accepted` row silently flips a cleared PR to `clears: false` and materializes a
hold that no reviewer asked for.

**So `observed` must be excluded from the fold's disposition entirely, not merely marked non-clearing.** It is
a row in `history`, and it is invisible to `current` / `clears` / `outstandingHolds`. This is the load-bearing
half of the item; the enum addition on its own is the easy part and would ship the bug.

## Also owed

- **`verdictLabel(observed)` returns `null`** — an `observed` row mirrors no label, by construction.
- **`verdictForLabelTarget` gains no case.** There is no `--to=observed` label swap, because there is no
  label. The row is written directly, never through `we:scripts/review-set-label.mjs`.
- **The Phase-1 checker must not report it as a disagreement.** `we:scripts/review-ledger-check.mjs` counts a
  ledger row with no matching label as drift — the precise signal it exists to surface. An `observed` row is
  *correctly* label-less, so it must be filtered out of the comparison set rather than inflating the drift
  count and burying a real orphan row.

## Not in scope

Writing the rows — that is `#3330`. This item lands the vocabulary and its fold semantics with no producer,
which is the same shape `RESTAMPED` and `ledgerCoversHead` already ship in.

## Done when

1. **Executable** — `npx vitest run verdict-ledger` passes with new cases in
   `we:scripts/lib/__tests__/verdict-ledger.test.mjs` proving: `buildVerdictRecord({verdict:'observed'})`
   validates; `verdictClears('observed') === false`; `verdictLabel('observed') === null`; and — the regression
   that matters — folding `[accepted, observed]` yields `clears: true` with `outstandingHolds: []`.
2. `npm run check:standards` passes.
