---
kind: story
size: 3
status: open
scope: ["we:scripts/review-set-label.mjs"]
dateOpened: "2026-09-30"
tags: []
---

# Review ledger: echo tagging and sender capture so our own label writes are never read as human edits

Follows ruling #4599. Every projection write (labels, comments) carries its outbox receipt id; labeled/unlabeled webhook events record sender. The drift detector ignores our own echoes and treats only verified human edits as observations. Route today label writers (we:scripts/review-set-label.mjs and the daemons) through the command path before drift counting starts. Filed for later.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
