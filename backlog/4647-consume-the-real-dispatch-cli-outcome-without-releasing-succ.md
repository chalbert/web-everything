---
bornAs: x34sep8
kind: story
size: 3
tier: pinned
status: open
scope: ["we:skills-src/conveyor/build-dispatch-daemon.mjs", "we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs"]
dateOpened: "2026-09-30"
preparedDate: "2026-10-01"
preparedAgainstSha: "382a4dedc89529305abf10223a902b8cc7d3a2aa"
tags: []
relatedReport: reports/2026-09-30-builder-launch-misread-root-causes.md
---

# Consume the real dispatch CLI outcome without releasing successful build claims

The builder reads the CLI summary as a persisted run, so accepted launch acknowledgements lack the effects array it expects. Resolve the summary's runId through the same configured run store and validate the dispatch effect before changing ownership. The mismatch remains reproducible at the current serializer/consumer boundary (we:scripts/operations/cli-adapter.mjs:1234; we:skills-src/conveyor/build-dispatch-daemon.mjs:129).

## Evidence

- The actual envelope carries `runId`, `op`, verdict and effect keys in `inFlight`, not effect rows or handles (we:scripts/operations/cli-adapter.mjs:1244-1256). The reader instead selects `parsed.run ?? parsed` and searches `run.effects` (we:skills-src/conveyor/build-dispatch-daemon.mjs:132-144).
- The CLI shell passes stdout directly to that reader; its exception path also parses stdout but discards an accepted result (we:skills-src/conveyor/build-dispatch-daemon.mjs:854-864). The build tick releases every claim whose result is not dispatching (we:skills-src/conveyor/build-dispatch-daemon.mjs:414-419).
- New build guards and launched numbers survive only for dispatched items; existing guards survive independently (we:skills-src/conveyor/build-dispatch-daemon.mjs:111-124, we:skills-src/conveyor/build-dispatch-daemon.mjs:655-659). Durable in-flight build rows can still protect subsequent ticks (we:skills-src/conveyor/build-dispatch-daemon.mjs:734-752, we:skills-src/conveyor/build-dispatch-daemon.mjs:377-378). Claim release alone therefore does not prove immediate capacity release or a duplicate launch.
- Existing parser coverage supplies a synthetic full run instead of the actual envelope (we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs:997-1001). Historical incident evidence is recorded in we:reports/2026-09-30-builder-launch-misread-root-causes.md:17-65; its code line numbers are historical, not the current implementation references above.

## Progress

Preparation premise check: reproduced the mismatch without launching an agent, using the real `newRunRecord`, `outcomePayload` and `readDispatchOutcome` exports (we:scripts/operations/run-record.mjs:88; we:scripts/operations/cli-adapter.mjs:1234; we:skills-src/conveyor/build-dispatch-daemon.mjs:129). An in-memory accepted dispatch with a synthetic PID handle returned `dispatching: true` as a full record and `dispatching: false`, reason `dispatch launch not confirmed (missing effect; no running session)`, after real serialization. This proves the schema mismatch, not process liveness.

Old premise/scope: build-only acknowledgement repair in the daemon and its test file, with serializer citation at line 1210 and reader citation at line 127. Corrected premise: the serializer now begins at line 1234 and the reader at line 129; the same CLI reader also serves preparation dispatch, whose caller releases claims and classifies failures (we:skills-src/conveyor/build-dispatch-daemon.mjs:605-612). Keep the same two-file scope, including tests, but cover both callers and the exception-stdout path. No producer/store change is required: the canonical store already resolves `OPERATION_RUNS_DIR`, validates IDs, and distinguishes missing from corrupt records (we:scripts/operations/run-store.mjs:55-58, we:scripts/operations/run-store.mjs:85-119).

## Design

1. At the CLI consumer boundary, parse the real envelope and load its `runId` with the existing run-store API, using the same environment as the child. The operation CLI uses `createFileRunStore` (we:scripts/operations/run.mjs:578); dispatch inherits the parent's environment (we:skills-src/conveyor/build-dispatch-daemon.mjs:856). Inject the read boundary for tests; keep the generic envelope unchanged.
2. Correlate envelope and record ID/op with `dispatch-lane`, requested item and requested launch kind. Validate the matching dispatch effect's type, payload, status, error and nonblank pollable handle; reject mismatched or ambiguous evidence. The payload carries item and launch kind (we:scripts/operations/dispatch-lane.mjs:1305-1322). Respect existing detached PID and background-session handle support (we:scripts/operations/dispatch-lane-io.mjs:2588, we:scripts/operations/dispatch-lane-io.mjs:2624); acknowledgement is not proof of completed delivery or current liveness.
3. Distinguish confirmed acceptance, confirmed refusal and indeterminate confirmation. A planner verdict or bare effect key cannot establish acceptance. Require correlated persisted evidence of non-dispatch before taking the refusal/release path. Missing/corrupt/unreadable records, malformed stdout, mismatches, handleless effects and transport exceptions remain indeterminate. An error alone is not a refusal: the executor intentionally retains an in-flight effect when a sink might have started work (we:scripts/operations/effect-executor.mjs:396-406).
4. Preserve claims, new guards and capacity protection on indeterminate confirmation without reporting successful dispatch or placing a failure hold. Carry a distinct observation result through bookkeeping and logs, including run ID when available. Confirmed accepted launches keep the normal dispatched path. Terminal applied/failed records must remain distinguishable from a running launch; leave terminal retirement to the existing settled-run path (we:skills-src/conveyor/build-dispatch-daemon.mjs:351-375), rather than translating terminal errors into permission to launch again.
5. Apply the reader contract consistently on normal stdout and exception stdout, and preserve preparation ownership on uncertainty at its shared caller. Keep typed preparation refusals on the existing observation-only route (we:skills-src/conveyor/build-dispatch-daemon.mjs:449-453, we:skills-src/conveyor/build-dispatch-daemon.mjs:605-612). Dispatch effects are non-idempotent; unknown outcomes must not trigger another launch (we:scripts/operations/dispatch-lane.mjs:1308-1317).

## MVP

Edit only we:skills-src/conveyor/build-dispatch-daemon.mjs and we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs during implementation. Add store-backed outcome resolution, explicit uncertainty handling in both dispatch callers, and bookkeeping protection for unconfirmed attempts. Use the existing serializer and store as dependencies, without changing their public contracts. Preserve existing retirement and hold policies; wrapper preflight settlement and claimless recovery remain separate work (#4649 and #4648 respectively; we:backlog/4649-settle-delivery-preflight-refusals-and-reject-unsupported-lo.md:44).

## Test plan

Extend we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs:997 with real file-store records serialized by `outcomePayload`, passed through `cliDispatch` with only process execution replaced. Exercise the real reader and runBuildDispatchTick, using isolated run/claim roots and no agent launches. Existing claim/restart fixtures start at we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs:80; update the unconditional false-result release expectation at line 153 to require confirmed refusal.

- Accepted in-flight dispatch: claim and new guard retained, correct launch reported, no failure/hold, occupied capacity and no second dispatch on a subsequent tick or restart.
- Confirmed non-dispatch refusal: claim released and no new launch guard; distinguish this from a planning verdict without correlated evidence.
- Missing, corrupt, unreadable or wrong-store record; malformed/empty output; wrong run ID, operation, item, launch kind or effect type; missing/blank handle; declared/pending effect; in-flight effect with an error. None may release ownership, report acceptance, hold the item as a failed launch, or permit a duplicate.
- Terminal applied/failed records: no fabricated running session or refusal; exercise existing retirement on the next tick. Cover accepted and indeterminate records returned through exception stdout as well as ordinary stdout.
- Preparation caller regression: accepted, refused and indeterminate outcomes preserve the corresponding preparation bookkeeping and failure classification (we:skills-src/conveyor/build-dispatch-daemon.mjs:605-612). Assert a configured temporary `OPERATION_RUNS_DIR` is used by both the child environment and record reader (we:scripts/operations/run-store.mjs:55-58).

Run the affected Vitest file, the lane verifier, and standards gate. Keep serializer-to-consumer and multi-tick assertions at the real boundary; synthetic full-run parser fixtures alone missed this incident (we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs:997).

## Proof plan

Implementation proof must include a regression that fails on the current serializer/consumer mismatch and passes through the corrected CLI boundary with a real persisted accepted record. Capture run ID, effect identity/status/handle, claim, guard, reported failures/holds and subsequent-tick occupancy; no agents are needed for this automated proof. The relevant boundaries are we:skills-src/conveyor/build-dispatch-daemon.mjs:845-864 and we:skills-src/conveyor/build-dispatch-daemon.mjs:414-419.

After the implementing lane's regression gate, stop active development for at least 30 minutes while the normal builder performs at least three naturally scheduled ticks and one real eligible delivery. Capture correlated run IDs, dispatch acknowledgements, claims and occupancy before and after the break; require zero missing-effect failures and zero duplicate launches. Do not force retries to satisfy the soak. If no eligible delivery occurs, report the live proof incomplete and continue observation; elapsed time alone is insufficient. This preparation performs no live delivery or soak.

## Done when

The real-envelope integration tests retain accepted and indeterminate ownership, release only confirmed refusals at the acknowledgement boundary, cover both shared callers, and pass the required gates. The scheduled-tick soak meets every Proof plan criterion.

## Follow-ups

Keep wrapper preflight/terminal settlement and claimless reconciliation in their separate cards, without widening this consumer repair (we:backlog/4649-settle-delivery-preflight-refusals-and-reject-unsupported-lo.md:44). Record testing lessons here, not in shared agent documentation.

The diagnosis-only lane reported verifier-marker and standards-admission permission failures (we:reports/2026-09-30-builder-launch-misread-root-causes.md:106-111). Those historical failures are not evidence about this lane: run both required gates here, and record any actual blocker without bypassing or weakening either gate.
