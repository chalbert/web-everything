---
bornAs: xq94q0w
kind: task
parent: "3029"
status: open
dateOpened: "2026-08-21"
tags: []
---

# verify: add a --suite input for the targeted inner loop

Not a new operation, a missing input on an existing one. The verify operation models only the whole-lane run, but the real edit-verify loop is targeted: a 2026-08-21 session audit counted 201 single-file test runs against 26 broad ones. With nowhere to go, ~90 percent of testing went to raw npx vitest. Add --suite so the inner loop has a declared home, keeping the three-valued outcome and the #2833 marker semantics of the whole-lane path.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
