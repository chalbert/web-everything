---
type: issue
workItem: task
status: open
dateOpened: "2026-06-18"
tags: []
---

# calibrate CLI silently trains on unrecognized --stop-reason tokens

scripts/backlog.mjs calibrate's trainsEstimate (capacity.mjs, #553) treats any --stop-reason NOT in its work-bound set {empty-pool,fork,gate,manual} as a capacity stop and TRAINS the estimate on it. A token typo or an un-listed work-bound reason (hit live this session: outgrew, a rule-4 stop) silently corrupted capacityPoints 147->43 from a 12pt@28% sample that carried no capacity signal; had to hand-fix capacity.json. Fix: either add outgrew to the work-bound set, or make the CLI REJECT unknown --stop-reason tokens (fail-closed) rather than defaulting to train. Found at batch-2026-06-18 close-out.
