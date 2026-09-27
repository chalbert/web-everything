---
bornAs: x37ac0i
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/operations/review-dispatch.mjs", "we:scripts/operations/review-extra-seats.mjs", "we:scripts/gemini-direct-task.mjs", "we:scripts/operations/__tests__/review-dispatch.test.mjs", "we:scripts/operations/__tests__/review-extra-seats.test.mjs", "we:scripts/__tests__/gemini-direct-task.test.mjs"]
dateOpened: "2026-09-26"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2714's independent review

Filed mechanically by the unattended review loop (#2749) — every finding below reduced chalbert/web-everything#2714's review to prevention-outstanding by naming a guard neither captured nor filed:

1. `we:scripts/operations/review-dispatch.mjs:178` — Add a deterministic check (e.g. in we:scripts/operations/review-job.mjs after the loop payload is read, or a check:standards rule) that flags/logs when 'simplicity' is in neither the loop payload's seated steps (`findings.judgeAdvisory`) nor this PR's ROUTED_ADVISORY_LENSES, so a silently-zero-coverage lens surfaces instead of being assumed covered.
2. `we:scripts/operations/review-extra-seats.mjs:606` — No test exercises this path — every seat-runner test drives `runSeat` through the `io.runSeat` fake, never a real hung process. The cheapest durable guard is either a real-process integration test that hangs a grandchild past the outer wall and asserts it's gone afterward, or propagating the leaf CLI's own pid/pgid up so the outer supervisor can target it directly instead of relying on group nesting.
3. `we:scripts/gemini-direct-task.mjs:91` — Pin/verify a minimum agy version known to have this deny behavior, and add a periodic live smoke test that sends a --review task attempting a shell/write call and asserts it comes back denied.
4. `we:scripts/operations/review-extra-seats.mjs` — Require a valid verdict and a findings array before setting ok; add deterministic tests for empty objects, arrays, error objects, and invalid verdicts.
5. `we:scripts/operations/review-extra-seats.mjs` — Use a locking mechanism with atomic ownership-safe recovery, or fail closed instead of reclaiming stale locks; add a deterministic interleaving test proving only one reservation writer enters.
6. `we:scripts/operations/review-extra-seats.mjs:617` — Use a battle-tested robust lockfile library instead of hand-rolling file-based locking, or add a concurrency test simulating tight lock acquisition races.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
