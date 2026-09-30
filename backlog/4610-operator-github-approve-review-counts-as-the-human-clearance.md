---
bornAs: xuzp80g
kind: story
size: 3
status: open
scope: ["we:scripts/review-set-label.mjs"]
dateOpened: "2026-09-30"
tags: []
---

# Operator GitHub Approve review counts as the human clearance

Follows ruling #4599. A GitHub Approve review from the operator account on the current head SHA counts as the human clearance, equivalent to the "I approve N" ceremony (we:scripts/review-set-label.mjs --to=clear-human), recorded with actor and head. Anyone else Approve is recorded as a comment only. Lets the operator approve from the phone. Coordinates with #3179 (authenticated human clearance evidence). Filed for later.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
