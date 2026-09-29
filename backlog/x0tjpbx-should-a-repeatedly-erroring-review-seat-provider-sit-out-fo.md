---
kind: story
size: 3
status: open
scope: ["we:scripts/lib/provider-routing.mjs", "we:scripts/operations/review-extra-seats.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# Should a repeatedly-erroring review-seat provider sit out for a cooldown instead of burning calls

A review-seat provider whose recent calls keep erroring still gets dispatched every review (we:scripts/lib/provider-routing.mjs's selectReviewSeatProvider only re-ranks a provider after a recent failure, it never skips it outright). Worth a small addition -- a per-provider/lens cooldown after N consecutive errors -- once fixing the underlying agy-claude --effort argv bug (this item's sibling) is not enough on its own for some future erroring provider. Needs its own PREPARE: how many consecutive errors, what cooldown length, per-lens or per-provider scope.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
