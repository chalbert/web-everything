---
bornAs: xzcvh9e
kind: task
status: open
dateOpened: "2026-08-30"
tags: []
---

# Enforce lockstep between we:vitest.config.ts exclude and we:vitest.integration.config.ts include

Add a check-standards rule or vitest test that reads we:vitest.config.ts's test.exclude list and we:vitest.integration.config.ts's test.include list and asserts every we:scripts/**/__tests__ (and we:scripts/operations/**/__tests__) entry excluded from the unit config is present in the integration config's include list. Currently the two lists are hand-synced and byte-identical (22/22 entries) with nothing enforcing they stay that way — a future edit to one without the other lets a test file silently stop running in either tier, with nothing going red to flag it. Surfaced by the correctness juror reviewing PR #1716 (chalbert/web-everything), finding at we:vitest.config.ts:66, disposition carve-out (preventionCaptured: false).

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
