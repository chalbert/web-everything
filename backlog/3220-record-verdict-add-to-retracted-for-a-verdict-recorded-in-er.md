---
bornAs: xi3hiug
kind: task
parent: "3029"
status: open
dateOpened: "2026-08-21"
tags: []
---

# record-verdict: add --to=retracted for a verdict recorded in error

On 2026-08-21 a verdict was staged for PR #1503 after it had merged. The applier correctly refused (#2953) so nothing was applied, but the row stands on the transport with no way to mark it withdrawn. Per the #3214 ruling the transport is append-only, so a retraction must be an APPEND, never a delete. A new --to value on the operation that already owns verdict transitions and their staging — not a separate operation.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
