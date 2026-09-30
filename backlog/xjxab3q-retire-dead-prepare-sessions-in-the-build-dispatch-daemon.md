---
kind: task
preparedDate: "2026-09-30"
status: resolved
scope: ["we:skills-src/conveyor/"]
dateOpened: "2026-09-30"
dateResolved: "2026-09-30"
tags: []
---

# Retire dead prepare sessions in the build dispatch daemon

Retire an in-flight prepare when its dispatch session is explicitly not live and either expectedBy has passed or lastSeenLiveAt is older than a 20-minute grace period. Reuse retirement to release claim and guard and record prepare-session-dead within the existing retry budget. Update we:skills-src/conveyor/build-dispatch-daemon.mjs and its related tests.

## Done when

1. Related Vitest tests pass for we:skills-src/conveyor/build-dispatch-daemon.mjs, covering expired dead sessions, grace-period retention, live sessions, claim/guard release, and bounded retry bookkeeping.
2. The daemon rejects an unknown flag with exit code 2.

## Prep

Use the dispatch entry live, expectedBy, and lastSeenLiveAt fields, with a 20-minute grace period. Reuse the existing retirement path and row settlement helper. Record prepare-session-dead without placing an unstamped hold; increment the existing itemPrepareAttempts budget and permit planning on a later tick.
