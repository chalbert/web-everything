---
type: issue
workItem: task
status: resolved
dateOpened: "2026-06-18"
dateStarted: "2026-06-18"
dateResolved: "2026-06-18"
graduatedTo: "we:scripts/backlog/capacity.mjs"
tags: []
---

# calibrate CLI silently trains on unrecognized --stop-reason tokens

we:scripts/backlog.mjs calibrate's trainsEstimate (we:scripts/backlog/capacity.mjs, #553) treats any --stop-reason NOT in its work-bound set {empty-pool,fork,gate,manual} as a capacity stop and TRAINS the estimate on it. A token typo or an un-listed work-bound reason (hit live this session: outgrew, a rule-4 stop) silently corrupted capacityPoints 147->43 from a 12pt@28% sample that carried no capacity signal; had to hand-fix we:.claude/skills/batch-backlog-items/capacity.json. Fix: either add outgrew to the work-bound set, or make the CLI REJECT unknown --stop-reason tokens (fail-closed) rather than defaulting to train. Found at batch-2026-06-18 close-out.

## Progress — resolved in batch-2026-06-18 (both arms)

Did **both** fixes the body offered:

1. **`outgrew` added to `NON_TRAINING_STOPS`** (we:scripts/backlog/capacity.mjs) — the rule-4 stop is
   work-bound and must never train the estimate.
2. **CLI now fails-closed on an unknown `--stop-reason`** — new `isKnownStopReason` /
   `KNOWN_STOP_REASONS` (union of training + non-training) exported from we:scripts/backlog/capacity.mjs;
   `calibrate()` in we:scripts/backlog.mjs rejects a non-empty token outside that set with a `die()` that
   lists the valid tokens, instead of the old fail-open default-to-train. An *absent* reason still trains
   (backward compatible). Help text + tests updated; 11 capacity unit tests green; smoke-tested both a
   typo (rejected) and `outgrew` (accepted, excluded from training).
