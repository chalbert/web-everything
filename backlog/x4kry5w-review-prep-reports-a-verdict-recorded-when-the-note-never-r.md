---
kind: story
size: 3
parent: "3029"
status: open
dateOpened: "2026-08-21"
tags: []
---

# review-prep reports a verdict recorded when the note never reached the card

Observed on two independent lanes on 2026-08-21. The operation returns stopped complete with applied effects and prints that the review was recorded, while the note is absent from the card — a write race with a concurrent edit in the same lane. This is success reported on a write that did not happen, the same class as open-pr classifying a post-open refusal as opened. A caller that trusts the report records a review that does not exist. The record effect must verify its own write landed, or report a third outcome, never a bare success.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
