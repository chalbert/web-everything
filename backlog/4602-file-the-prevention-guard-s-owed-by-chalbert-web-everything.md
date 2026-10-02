---
bornAs: xdu61tj
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:skills-src/conveyor/build-dispatch-daemon.mjs", "we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs", "we:scripts/conveyor/tick-core.mjs", "we:scripts/conveyor/__tests__/tick-core.test.mjs"]
dateOpened: "2026-09-30"
preparedDate: "2026-10-02"
preparedAgainstSha: "ac2e9dc86bcaf9c5f27bcc5a2091e11de598e967"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3079's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

The owed guards are a table-driven check that each real prepare attempt is counted once across core TTL retirement and daemon session-dead retirement, and a daemon-level repeated-tick test that exhausts the existing retry cap. Current implementation and test locations are recorded below; the original review line numbers are historical.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3079@205c57c84d43c26174dc658b88e453a3546444bd

## Done when

1. **Executable** — the focused Vitest suite covering `we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs` and `we:scripts/conveyor/__tests__/tick-core.test.mjs` includes the source matrix and a real-core daemon exhaustion test described below. Demonstrate a red assertion against the prior counting behavior, then green after the minimal repair; if a case already passes, report that honestly and demonstrate its sensitivity with a temporary counting/cap mutation.
2. A claimed attempt counts exactly once whether TTL and session death are observed together or on different ticks; a distinct later attempt counts separately. Actual dispatch calls stop at the existing configured cap and remain stopped on subsequent ticks.

## Progress

- Original premise/scope: the review cited `we:skills-src/conveyor/build-dispatch-daemon.mjs:451` and `we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs:1600`, with only those two files in scope. It requested missing prevention tests and suggested attempt identity rather than a blind counter.
- Corrected premise: session-dead accounting now lives at `we:skills-src/conveyor/build-dispatch-daemon.mjs:571-575`. Its maximum of the core result and the incoming count plus one prevents same-tick double counting, but contains no identity check for a TTL count from an earlier tick. This is a source-level gap to exercise, not a claim that a production failure has been reproduced.
- Source evidence: `we:scripts/conveyor/tick-core.mjs:1283-1295` retains counts for held items and increments claimed TTL retirements; `we:scripts/conveyor/tick-core.mjs:691-700` enforces the cap. Existing daemon coverage at `we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs:1844-1877` checks one retirement and one subsequent launch. Its fixture at `we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs:1373-1386` always proposes spawns and omits the core's attempt state, so it cannot prove cap exhaustion. Core coverage at `we:scripts/conveyor/__tests__/tick-core.test.mjs:933-965` checks rotation and unclaimed TTL behavior, not the daemon/core counting overlap.
- Corrected scope: include `we:scripts/conveyor/tick-core.mjs` and its matching `we:scripts/conveyor/__tests__/tick-core.test.mjs` for the shared accounting boundary. Preserve the original prevention goal and existing retry policy; no new retry budget, hold policy, or dispatch provider is proposed. Preparation is based on source inspection; no new regression has yet been executed.

## Design

Treat TTL retirement and session-dead retirement as observations of an attempt, not independent failed attempts. Add the source matrix at the daemon boundary first. If it exposes duplicate counting, carry a stable attempt identity through the existing prepare guard/bookkeeping and reconcile the daemon's run identity with that guard before either retirement drops it. The same attempt observed later must not consume another slot; a new run for the same item must consume one. Preserve existing numeric counts as the planner input, retain legacy bookkeeping compatibility, and clear identity history with the existing item-count lifecycle. Do not infer attempt identity from item number alone or from the current observation tick.

Keep the change within `we:skills-src/conveyor/build-dispatch-daemon.mjs` and `we:scripts/conveyor/tick-core.mjs`, with their scoped tests. The existing cap, claimed-only TTL rule, live/unknown session protection, and successful stamp recovery remain the contract. A tally refactor is needed only to satisfy the guard assertions, not as a separate rewrite.

## MVP

1. Add a table-driven regression in `we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs`: session death alone, claimed core TTL plus death in the same tick, and claimed core TTL in an earlier tick followed by death of that same run. Start with a nonzero count so accidental resets are visible; repeat the observation and then supply a distinct run.
2. Add a multi-tick daemon harness using the real `planTick` from `we:scripts/conveyor/tick-core.mjs` through the injected planning effect. Maintain claims, run rows, settlements, lane observations, and returned bookkeeping across ticks; mock external dispatch and status reads. Force the existing Claude prepare fallback explicitly so routing defaults cannot silently exercise a different provider.
3. Repair only accounting defects reproduced by these cases. Add focused core coverage in `we:scripts/conveyor/__tests__/tick-core.test.mjs` for any new identity state, its carry-forward, legacy input, and cleanup.

## Test plan

- Matrix assertions: exactly one increment per real attempt, no increment for an unclaimed TTL guard alone, no duplicate on replay, and one additional increment for a new attempt on the same item. Test same-tick and earlier-tick overlap separately.
- Exhaustion: use one eligible needs-prepare item and the real configured cap. Every dispatched attempt receives a unique run id and a confirmed dead session with no sections, stamp, or PR. Advance a controlled clock beyond the liveness deadline and feed each `nextBookkeeping` into the next tick. Assert the exact dispatch count reaches the cap, the planner reports `prepare-item-retry-cap`, and at least three additional eligible ticks dispatch nothing. Do not stop the loop merely by exhausting available lanes or removing the candidate.
- Preserve live and unknown session behavior, successful stamp recovery, and unclaimed TTL semantics using existing cases. Assert no observation-only event consumes an attempt.
- Run the focused Vitest suite for `we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs` and `we:scripts/conveyor/__tests__/tick-core.test.mjs`, through the repository heavy-admission wrapper `we:scripts/readiness/heavy-admission.mjs`, then `npm run check:standards` during implementation validation.

## Proof plan

Capture the source-matrix failure before repair, including the prior count, retirement source, run/guard identity, and resulting count. Capture the passing result after repair. For the exhaustion guard, record actual mocked dispatch calls and the final cap note across the full loop; a pre-seeded count at the cap is not exhaustion evidence. Temporarily disable deduplication and cap enforcement separately to show the corresponding tests fail, then restore the implementation and rerun the focused suite. All probes use temporary state and injected external effects; no real worker, PR, or production daemon is required. The runner owns preparation stamping and review checks.

## Follow-ups

None required for this prevention slice. Durable retry history across daemon restarts, changes to retry/hold policy, and other dispatch families are outside this item's existing in-session attempt contract. If the harness exposes a separate defect, record its evidence for a follow-up rather than expanding this patch into a general retry redesign.
