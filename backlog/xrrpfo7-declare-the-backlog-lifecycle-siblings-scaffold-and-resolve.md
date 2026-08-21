---
kind: story
size: 3
parent: "3029"
status: open
dateOpened: "2026-08-21"
tags: []
---

# Declare the backlog lifecycle siblings: scaffold and resolve

claim is a declared operation; its two siblings in the same lifecycle are not. A session on 2026-08-21 made 45 raw we:scripts/backlog.mjs scaffold calls and 15 raw resolve calls. The cost is not ceremony: PR #1503 round 1 was a finding that a decision card body said RATIFIED while its status stayed open, leaving four siblings blocked — precisely the two-writes-must-agree shape a declared resolve with a three-valued outcome would refuse to half-apply.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
