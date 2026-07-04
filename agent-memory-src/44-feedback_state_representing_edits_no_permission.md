---
name: feedback_state_representing_edits_no_permission
description: "A backlog edit that reflects the REAL state (a true blocker edge, cross-ref, fixed relationship) is default-do — apply it, don't ask permission"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: b185c785-d82a-4947-bbcf-6aec86e86742
---

A data edit that merely **records the real state** — a genuine `blockedBy` edge, a cross-reference to a parallel-track item, a corrected relationship — is **applied by default, never gated behind asking**. When I surfaced the #1476→#1480 blocker during /close and *offered* to add it, the user: "add the blocker if represent the state, should not have to ask."

**Why:** capturing true state is a fix, not a judgment call; asking adds a round-trip for something with one correct answer. This overrides the closing-session skill's "with the user's go-ahead" wording **for state-representing edits specifically** (it still holds for genuinely ambiguous captures or new scope).

**How to apply:** if an edge/cross-ref/relationship is provably the real state, just write it (then re-gate + commit) and report it in the summary — don't present it as an open question. Reserve asking for genuinely ambiguous calls. Mirrors [[feedback_misflagged_batchable_fix_real_state]] (fix the real relationship in data, don't skip/ask) and the backlog "update by default" rule for decision items.
