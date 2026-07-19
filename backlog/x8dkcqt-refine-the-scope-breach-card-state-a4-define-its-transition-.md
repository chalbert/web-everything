---
kind: story
size: 3
status: open
dateOpened: "2026-07-19"
tags: []
---

# Refine the scope-breach card state (A4) — define its transition table

A4 'paused — scope breach' is a designed state in the 37-state taxonomy (plateau business logic, sibling to #2553) whose post-pause behavior is unspecified. Detection already exists (the write-time PreToolUse Edit|Write gate denies out-of-scope writes). The gap is the transition table. Decide: (a) is item scope finer-grained than today's per-lane lease (we:scripts/lane-pool.mjs holds a whole-clone lease, not per-file)? (b) after the auto-pause, what are A4's exits — re-plan within scope; widen the scope/lease; hand off to the cross-lane family (B2 overlap / B3 forced-past / B8 rival) when the wanted files belong to another lane; or bounce/drop if the slice was mis-scoped. A4 is tagged cat:run (auto/system, not amber needs-you), signalling intended auto-handling. The glyph decision (A4 -> octagon-alert) is settled and independent of this.

**Related gap — extend to A12 "merge held":** A12 is the *voluntary* merge-hold (verb "Unhold merge", amber needs-you), the deliberate counterpart to A6 park-by-policy and A4 involuntary-fault. Same open question: *who* can place the hold — the user only, or also a policy / a sibling lane? Pin A12's hold-source alongside A4's exits, since both are transition/source details the taxonomy lists but doesn't yet define.
