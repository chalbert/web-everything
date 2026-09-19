---
bornAs: x7kjrzg
kind: story
size: 3
parent: "2405"
blockedBy: ["3214"]
status: resolved
dateOpened: "2026-08-20"
dateStarted: "2026-09-08"
dateResolved: "2026-09-08"
tags: []
scope:
  - we:scripts/merge-ai-prs.mjs
  - we:scripts/lib/verdict-ledger.mjs
  - we:scripts/__tests__/
  - we:scripts/lib/__tests__/
---

# Ledger the holds the drain applies itself, not just the review seam

The verdict ledger covers the review seam only. Holds the drain applies on its own, including the stale-acceptance re-park, are unledgered, and the checker counts them on their own line. Flipping the merge authority to the ledger without this would make every drain re-park a no-op and re-open the hold that did not hold from the other side. This is the blocking precondition for the flip, not a nice-to-have.



## Why this blocks the flip rather than following it

The ledger records what the **review seam** decides. The drain also applies holds of its own — `applyLabel`
in `we:scripts/merge-ai-prs.mjs`, including the stale-acceptance re-park — and none of them is written to
the ledger. `we:scripts/review-ledger-check.mjs` already counts them on a dedicated `unledgered` line, which
is how the gap is visible at all.

Flip the authority with that gap open and every drain re-park becomes a **no-op**: the drain would apply a
hold the ledger has never heard of, and a gate answering from the ledger would merge straight past it. That
is "the hold that didn't hold" (`#2750`, `#2820`, `#2745`) re-opened from the other side — the exact class
`#3007` exists to close.

It is also the precondition that makes the evidence gate reachable: `summarizeAgreement().phase2Safe`
requires zero disagreements **and** zero unledgered labels, and the second can only reach zero once the
drain writes.

## Done when

Every hold the drain applies itself appends a ledger record through the format's single owner
(`we:scripts/lib/verdict-ledger.mjs`), `review-ledger-check`'s `unledgered` count can reach zero on a live
board, and a test drives a drain-applied re-park and asserts the row exists with the drain named as its
author.

## Progress

Added `recordDrainVerdict` in `we:scripts/merge-ai-prs.mjs` — the drain's own writer through the ledger's
single owner (`buildVerdictRecord`/`appendVerdict`), mirroring `we:scripts/review-set-label.mjs`'s Phase-1
write for the review seam: same fail-soft posture, `source: 'merge-ai-prs'`, `declaredActor: 'drain'`. Wired it into the
ONE site the drain applies a hold label on its own (`gate.applyLabel` inside `shouldApplyReviewLabel`), ahead
of the `gh pr edit --add-label` transport call, so a fresh park and a #2409 stale-acceptance re-park both
ledger before they touch GitHub. The verdict is derived from the SAME label `decideReviewGate` returned via
`labelVerdictOf`, so it can never disagree with what `review-ledger-check`'s comparator would read from the
label. Covered by `we:scripts/__tests__/merge-ai-prs-drain-verdict-ledger.test.mjs` (unit behavior for
pending/human/unknown labels + the stale-acceptance re-park, using the real `appendVerdict`/`readVerdictLedger`
against a temp ledger dir) and a source-contract wiring test (the established pattern for this file's
un-executed `runCli` park loop) pinning the call site's ordering and arguments.
