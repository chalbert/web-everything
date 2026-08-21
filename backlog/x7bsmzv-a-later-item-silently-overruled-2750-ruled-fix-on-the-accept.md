---
kind: task
parent: "2405"
status: open
dateOpened: "2026-08-21"
tags: []
---

# A later item silently overruled #2750 ruled fix on the accept branch

#2750 ruled that the accept transition must REFUSE rather than strip a review:changes label. #2974 later shipped the accept branch stripping it — the opposite — and nothing recorded that a ruled fix had been reversed. Found by an independent juror reading we:scripts/review-set-label.mjs on 2026-08-21. Whichever behaviour is right, the governance failure is that a ruling was overturned by a later build with no trace on either card, which is the same class as a decision card reading RATIFIED while its status stayed open. Decide which behaviour stands and record the reversal on both items.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
