---
bornAs: x17s5az
kind: task
parent: "3963"
status: open
scope: ["we:scripts/conveyor/review-status-tag.mjs", "we:scripts/operations/review-dispatch.mjs"]
dateOpened: "2026-09-23"
tags: []
---

# plateau reviews dispatch then go review-stalled

On 2026-09-23 the review daemon dispatched reviews for plateau-app #174, #175, #177 and #181, and each then went review-status:review-stalled. Find why a plateau review session stalls (lane, cwd, brief, gate, or permission prompt) and fix it; reviews are the one stage that already claims to work for plateau.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
