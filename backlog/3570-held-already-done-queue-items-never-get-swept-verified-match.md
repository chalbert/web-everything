---
bornAs: xhgw5nu
kind: task
parent: "3457"
status: open
scope: ["we:scripts/readiness/dispatch-plan.mjs", "we:scripts/operations/dispatch-lane-io.mjs", "we:scripts/conveyor/duplicate-pr-watch.mjs"]
dateOpened: "2026-09-07"
tags: []
---

# Held already-done queue items never get swept — verified matches pile up forever, wasting apparent queue capacity

Live-observed 2026-09-07: node we:scripts/readiness/dispatch-plan.mjs's held list carried 71 items; 33 of them (46%) were 'already-done' (a merged PR already appears to close the item out). #3457/#3460 (both resolved) deliberately made this signal HOLD-ONLY, never auto-resolve — we:scripts/operations/dispatch-lane-io.mjs's filterAlreadyDoneCandidates docblock states the false-positive risk (an auto-resolve would be unrecoverable) explicitly, and that is the right call for the signal alone. But nothing exists downstream to do the verify-then-resolve legwork on the resulting held pile — no mechanical or semi-mechanical sweep walks 'already-done' holds, confirms each against the merged PR's actual diff (e.g. did it flip this item's own status: resolved, or touch its scope), and resolves the confirmed ones. Today they simply accumulate: once flagged, an item stays 'already-done' in every future we:scripts/readiness/dispatch-plan.mjs run until a human or agent happens to notice and hand-resolves it, so the queue reads far larger and more starved than the real actionable backlog — 33 of tonight's 71 held items are this phantom demand, not real blocked work. Needs a bounded sweep (mirroring we:scripts/conveyor/duplicate-pr-watch.mjs's alert-or-fix template) that either (a) surfaces a batch-reviewable list of already-done holds with their merged-PR evidence for a session to clear quickly, or (b) adds the second gh call (confirming the merged PR's diff actually resolved the item) that #3457's own residual-risk note named as the path to a safe auto-resolve — the exact shape is an open implementation choice.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
