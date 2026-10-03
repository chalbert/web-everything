---
kind: story
size: 3
status: open
scope: ["we:scripts/conveyor/tick-core.mjs", "we:scripts/conveyor/__tests__/tick-core*.test.mjs", "we:skills-src/conveyor/runner.mjs", "we:skills-src/conveyor/__tests__/runner.test.mjs", "we:scripts/conveyor/driver-status.mjs", "we:scripts/conveyor/__tests__/driver-status.test.mjs"]
dateOpened: "2026-10-01"
preparedDate: "2026-10-03"
preparedAgainstSha: "d698e436ed758e48283f478605022baf96dde437"
tags: []
---

# A load-cap hold that lasts over 30 minutes raises a health alert naming the cause and the top memory and CPU processes

The reported 2026-10-01 incident was a memory-pressure level 2 hold lasting more than three hours despite 51% memory free and 56% CPU idle. The reported largest consumer was fseventsd at 8.2 GB; lane-clone churn/editor watchers were a hypothesis, not a proven cause. Preserve the goal: surface a prolonged load-admission hold, its measured gate reason, and process evidence without changing admission policy.

## Progress

- Original premise/scope: extend the tick's held-stall counter and change we:scripts/readiness/heavy-admission.mjs; the incident narrative described all build/fix/review/CI-heal launches as silently held.
- Corrected premise: we:scripts/readiness/heavy-admission.mjs:398 (`loadAdmissionDecision`) already returns the triggering reason and readings. Its pressure condition remains independent of free-memory percentage. No admission implementation change is needed. we:scripts/conveyor/tick-core.mjs:1359 applies load-cap to builds, and its shared lane budget gates prepare/fix/CI-heal. This does not establish that every independent review launcher is governed by this tick. Existing per-tick load-cap notes are present; the missing feature is elapsed-hold health reporting with process evidence.
- we:scripts/conveyor/tick-core.mjs:1596–1607 feeds only `plan.held` entries to `advanceHeldStall`, counting repeated item/reason ticks rather than elapsed load-admission time. The CLI shell in the same file reads `load-status` at line 2020 and calls `planTick` at line 2091. No separate tick shell needs adding.
- Corrected scope adds the actual output path: we:skills-src/conveyor/runner.mjs `tickSurface` forwards notes, but `writeDriverStatus` persists only status line, stalled entries and dispatch. we:scripts/conveyor/driver-status.mjs `formatStatus` currently renders item stalls only. Both need the structured load alert and matching existing tests. Tick changes are covered by we:scripts/conveyor/__tests__/tick-core*.test.mjs.
- Reuse, without modifying, we:scripts/operations/host-process-sample.mjs `readProcessSample` (bounded ps call, empty result on failure), `categorizeProcess` (conveyor/drain/dispatched-agent recognition), and we:scripts/operations/command-redact.mjs `redactCommandLine`. Process attribution identifies observed consumers; it cannot prove why kernel memory pressure rose or whether host-daemon work was induced by our jobs.

## Design

1. Add session bookkeeping for the continuous observed load hold: first-held epoch milliseconds, last observed time, tick count and latest admission readings. Use injected `now`, not an assumed tick cadence. Any `held !== true` observation clears the episode, including bypass/no-sample; an uninterrupted hold keeps its start even when its reason changes. Missing/invalid clocks cannot manufacture elapsed time; a backward clock restarts timing. This follows the existing session-ephemeral bookkeeping contract; a driver restart begins a new observed episode.
2. In we:scripts/conveyor/tick-core.mjs, expose a structured `loadHoldAlert` once elapsed time is strictly greater than 1,800,000 ms. Include start, observation time, duration, current reason and admission readings. Emit one health-warning note per tick while active, and make the status line warn even if lane health is otherwise ok. Clear it on recovery. Do not create one alert per suppressed item or require a pending build to observe the host gate.
3. The CLI I/O shell in we:scripts/conveyor/tick-core.mjs enriches active alerts with one bounded process sample; the pure planner performs no OS reads. Rank the full sampled rows independently by RSS and CPU, taking five each (or all available if fewer), with PID as deterministic tie-breaker. Include PID, redacted/truncated command, RSS bytes and CPU percent, plus sample time. Classify before redacting; never persist raw argv. Preserve the alert with an explicit unavailable diagnostic when sampling fails/returns no rows.
4. Label recognized project processes using the existing categories; describe unmatched consumers as host/unattributed, not proven external causes. The warning names the exact admission cause and shows ownership labels on both rankings; mixed and unavailable evidence stays explicit. Do not infer that the top process caused the pressure or invent a binary causal verdict unsupported by the sample.
5. Carry the enriched alert through we:skills-src/conveyor/runner.mjs `tickSurface` and `writeDriverStatus`, then render duration, cause, readings and both process lists in we:scripts/conveyor/driver-status.mjs `formatStatus`. Missing fields in older snapshots remain supported. Use the existing runner note/status surface; no new notification transport or automatic remediation.

## MVP

- One continuous hold timer and one structured warning, exposed in tick output, runner output and durable driver status.
- Five memory consumers and five CPU consumers with observed ownership labels and a bounded diagnostic failure path.
- Preserve every existing dispatch/admission decision, threshold, bypass and failure behavior. Free-memory percentage does not override pressure; no processes are killed and no retries are forced.
- Matching test scope: we:scripts/conveyor/tick-core.mjs → we:scripts/conveyor/__tests__/tick-core*.test.mjs; we:skills-src/conveyor/runner.mjs → we:skills-src/conveyor/__tests__/runner.test.mjs; we:scripts/conveyor/driver-status.mjs → we:scripts/conveyor/__tests__/driver-status.test.mjs.

## Test plan

- In we:scripts/conveyor/__tests__/tick-core.test.mjs, drive successive `planTick` calls with returned bookkeeping: first hold, 29:59, exactly 30:00, and 30:00.001; only the last alerts. Cover irregular ticks, reason changes, recovery/re-entry, absent admission, invalid/backward clock and an empty queue. Assert status warning and no changes to allowed/suppressed dispatches.
- Add focused cases under we:scripts/conveyor/__tests__/tick-core-load-hold.test.mjs for the proposed injectable enrichment helper: distinct RSS/CPU orderings, ties, fewer than five rows, own/host/mixed classifications, secret/control-character redaction, timeout/empty sample and exactly one process read per active tick, none before threshold. Verify a missing sample does not hide the gate warning.
- In we:skills-src/conveyor/__tests__/runner.test.mjs, pass the enriched planner output through the runner and read its temporary status file back. Assert the alert survives projection/persistence and clears on recovery; old output without the field still works.
- In we:scripts/conveyor/__tests__/driver-status.test.mjs, assert human-readable cause, elapsed duration, both ranked lists, ownership and unavailable evidence, plus backward compatibility and recovery without a stale warning.

## Proof plan

Run the focused Vitest files above using `npx vitest run`, including the new we:scripts/conveyor/__tests__/tick-core-load-hold.test.mjs. Record a regression assertion failing against the pre-change implementation and passing after implementation; a missing test file alone is not the before-proof.

Exercise the real planner → enrichment → runner persistence → status formatter path with a temporary directory and injected timestamps straddling 30 minutes. Capture the rendered warning and persisted alert for the reported pressure-2/idle-56 fixture, then a recovered tick showing its removal. Separately call the existing process sampler on the host and verify both rankings against that same captured sample, reporting unavailable data honestly. Do not induce host pressure, wait 30 minutes, dispatch real work, or treat the historical fseventsd report as a fresh measurement. Run `npm run check:standards` as the implementation gate.

## Done when

- The regression command over the focused test files passes and the end-to-end local fixture shows an alert only after 30 minutes, with the actual gate reason and both process rankings (or explicit unavailable evidence).
- A separate driver-status read exposes the warning without inspecting raw tick logs; recovery removes it.
- Existing load-cap tests still prove identical admission behavior. Ownership evidence never claims an unobserved causal explanation.

## Follow-ups

- Operator policy question remains separate: should pressure level 2 hold when free memory exceeds 40%? This item does not answer it.
- Cross-restart continuity, independent review-daemon monitoring, push notifications, and investigation of fseventsd's upstream workload are separate work; this change reports the tick's observed gate and process evidence.
