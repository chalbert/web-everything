---
bornAs: x2ij3r2
kind: story
size: 3
parent: "4075"
status: active
scope: ["we:scripts/conveyor/session-reaper.mjs", "we:scripts/operations/run-store.mjs"]
dateOpened: "2026-09-24"
dateStarted: "2026-09-25"
tags: []
---

# Retention sweep: delete a finished conveyor session's records once its work is done

Build clause 1 of #conveyor-session-lifecycle-policy (#4082). Nothing deletes finished-session records today (1581 job entries, 92 run records). Delete a session's background entry (`claude rm`), run records, completion records, delivery reports and lane-port mapping only after its card is resolved/withdrawn, its PR merged/closed, its introspection has run and (once #4071 exists) its cost is rolled up; then after a grace setting (default 1 day), capped by a ceiling setting (default = host transcript retention). Both settings accept "never".

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
