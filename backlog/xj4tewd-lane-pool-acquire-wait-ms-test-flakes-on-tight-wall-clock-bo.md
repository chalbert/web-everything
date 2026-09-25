---
kind: task
parent: "4075"
status: resolved
scope: ["we:scripts/lane-pool.mjs", "we:scripts/__tests__/lane-pool-acquire-wait-ms.test.mjs"]
dateOpened: "2026-09-25"
dateStarted: "2026-09-25"
dateResolved: "2026-09-25"
graduatedTo: none
tags: []
---

# lane-pool-acquire-wait-ms test flakes on tight wall-clock bound under busy CI

Flaky: `we:scripts/__tests__/lane-pool-acquire-wait-ms.test.mjs` asserts `elapsed < ACQUIRE_POLL_MS` (1000ms) for the no-`--wait-ms` instant-fail case in `we:scripts/lane-pool.mjs` `acquire`. Live-caught on PR #2596 and #2634 CI ~11:05Z 2026-09-25 (also #2643): 1030/1011/1003ms observed — a busy runner alone pushes baseline process/git overhead past the 1000ms ceiling with zero actual polling, so the assertion false-fails. Fix: make the guard deterministic — count actual poll iterations (env-gated debug counter in `we:scripts/lane-pool.mjs`, no default-behavior change) instead of relying on a tight wall-clock bound that overlaps with CI noise.

## Done when

1. **Executable** — `npx vitest run --config we:vitest.integration.config.ts we:scripts/__tests__/lane-pool-acquire-wait-ms.test.mjs`, looped 20x under real CPU load, is 0/20 flaky after this lands (was observed to fail intermittently before, e.g. `expected 1001 to be less than 1000`, reproduced live in this session's before/after proof).
