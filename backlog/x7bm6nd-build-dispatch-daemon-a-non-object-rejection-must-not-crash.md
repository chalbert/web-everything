---
kind: story
size: 2
status: open
scope: ["we:skills-src/conveyor/build-dispatch-daemon.mjs", "we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs"]
dateOpened: "2026-10-02"
tags: []
---

# build-dispatch-daemon: a non-object rejection must not crash the tick

Follow-up from the #3215 advisory (2026-10-02). we:skills-src/conveyor/build-dispatch-daemon.mjs:222 assigns error.timings on whatever was thrown; a string, null or undefined rejection throws a TypeError and hides the original failure. Fix: guard with a typeof object check (wrap primitives). Test: an effect that rejects with a string still reports its timings and the original reason.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

Hint: a card that loosens a refusal needs two Must lines — what happens on error (refuse), and every input kind besides source code (docs, config, data) that the loosening must still treat cautiously.
