---
kind: decision
status: open
blockedBy: ["2908"]
dateOpened: "2026-08-08"
tags: []
---

# Deadlock relief: progress-gated rounds vs partial escalation of the disputed finding

Under #2908 deadlock — rounds spent with the panel still at changes — is one of only two failure paths that reach the operator. The round cap is flat: elevated gets 2 rounds whether the loop is converging or oscillating. Two candidate mechanisms with different tradeoffs. (a) Progress-gated rounds: grant another round while the finding count is falling, stop on a plateau; tunes the cap rather than removing it, still needs a hard ceiling. (b) Partial escalation: land the agreed part, escalate only the disputed finding; much smaller hand-off, but the loop verdict is whole-diff today so this is real machinery. Not exclusive — prepare both.
