---
bornAs: xr9zwxn
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:skills-src/conveyor/build-dispatch-daemon.mjs", "we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs", "we:scripts/operations/__tests__/probation-build-run.test.mjs", "we:scripts/check-standards-rules.mjs", "we:scripts/__tests__/check-standards-rules-scorecard-reads.test.mjs", "we:scripts/check-standards.mjs", "we:scripts/__tests__/check-standards.test.mjs", "we:docs/agent/testing.md", "we:docs/agent/delivery-loop.md"]
dateOpened: "2026-09-30"
preparedDate: "2026-10-02"
preparedAgainstSha: "939c3261800985624fff2cbfeeefe08dec93230f"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3051's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval"). Preserve the three debts: exercise circuit-breaker recovery across daemon ticks, prevent scorecard-store bypasses, and exercise the hook-security boundary on prepare repair attempts.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3051@086fa8f3ed4b39e2813de8fa5c68a194ec6ba5a0

## Progress

Preparation research corrected the original locations and scope:

- **Old premise:** the fallback at we:skills-src/conveyor/build-dispatch-daemon.mjs:66 needed a cooldown, periodic probe, or manual reset. **Current evidence:** `prepareRouteFallback` is at we:skills-src/conveyor/build-dispatch-daemon.mjs:75; it already requires exact-attempt releases for `route:prepare`. The tick reads releases at line 262 and selects the route at lines 448–450. The helper-only test at we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs:2029 covers partial/full releases but not successive ticks. we:scripts/conveyor/prepare-failure-policy.mjs:29 validates release evidence and fix-commit ancestry before exposing releases. **Corrected scope:** test the existing manual reset across ticks; do not introduce automatic cooldown or change release policy. Explicit routing policy takes precedence and must remain covered.
- **Old premise:** a raw scorecard read lived at we:skills-src/conveyor/build-dispatch-daemon.mjs:878 and the store was identified only by a basename. **Current evidence:** `cliEffects().listProbationPrepares` at we:skills-src/conveyor/build-dispatch-daemon.mjs:1266 resolves the shared path but still parses raw filesystem bytes. The supported reader is `readStore` at we:scripts/conveyor/run-scorecard-store.mjs:300, including migration and empty-store handling. **Corrected scope:** replace this bypass and add a standards guard with matching rule and gate tests. The authoritative store is shared machine state; we:scripts/conveyor/run-scorecards.json is a legacy migration input, not the default store.
- **Old premise:** we:scripts/operations/__tests__/probation-build-run.test.mjs:806 was the retry-security test location. **Current evidence:** hook tampering tests are at lines 523–555; the clean repair retry is at line 857. The hook snapshot/check already runs inside the attempt loop at we:scripts/operations/probation-build-run.mjs:409–424. **Corrected scope:** add attempt-indexed security cases to the existing test harness, not a new production retry mechanism.
- The original scope contained only the daemon and two test files. It omitted the standards guard integration and the requested review/testing guidance. The revised scope adds those owners and matching tests for each source file. The proposed we:scripts/__tests__/check-standards-rules-scorecard-reads.test.mjs is new; the other scoped test files exist. Source inspection finds remaining guard work, so this is not already delivered.

## Design

Retain the existing release-based circuit breaker. Drive `runBuildDispatchTick` twice with shared bookkeeping and two failed probation prepare records. With no explicit prepare route, tick one uses fallback; supply releases for every failed exact attempt before tick two and observe probation becoming available again. A control with only one release must remain on fallback. Use distinct eligible candidates or retire the first claim so claim suppression cannot masquerade as a route assertion. Also assert an explicit configured route continues to win over failure history and releases.

Replace the daemon's raw read with `readStore().records` from we:scripts/conveyor/run-scorecard-store.mjs. Keep the effect's array interface and the existing route filtering. Exercise the real reader with a temporary explicit store path, including absent, malformed and valid stores; inject the path/reader through a narrow test seam if necessary. Never read or migrate the operator's live store in tests.

Add a pure scorecard-read scanner to we:scripts/check-standards-rules.mjs and compose it into we:scripts/check-standards.mjs. Scan production JavaScript modules under we:scripts/ and we:skills-src/ for filesystem reads of the literal scorecard filename or a variable assigned from `resolveScorecardStorePath`, including aliased imports and namespace filesystem calls. Follow local variable aliases; ignore comments and string-only documentation. Emit an error with file/line and the supported reader. This is a bounded static guard, not a claim of arbitrary interprocedural dataflow analysis. Exempt the owning we:scripts/conveyor/run-scorecard-store.mjs, tests/fixtures, and the explicit legacy migration routine in we:scripts/lib/daemon-rebuild.mjs; do not exempt entire operational directories. Safe path resolution, backups, and calls to `readStore` are not direct reads. Inventory hits before enabling the gate; the daemon bypass is the observed initial production violation.

In we:scripts/operations/__tests__/probation-build-run.test.mjs, parameterize the existing hook-security assertions by worker attempt (first or repair) and worker outcome (success or failure). For repair cases, the first clean attempt must fail stamp validation to reach the second worker invocation. Plant the changed hook snapshot only on the selected attempt. Assert restoration precedes discard, failed restoration skips discard, and neither commit nor PR opening occurs after tampering.

Document the review lens in we:docs/agent/delivery-loop.md: every circuit breaker identifies its half-open or explicit reset path and evidence that exercises it. Document the attempt-indexed security-test pattern in we:docs/agent/testing.md. No new routing policy, release schema, scheduling infrastructure, or public standard is introduced.

## MVP

1. **Must 1:** Add successive-tick recovery and partial-release/control-route regressions using the existing release contract.
2. **Must 2:** Route the daemon read through the store API and add the executable standards rule, scanner fixtures, and gate wiring coverage.
3. **Must 3:** Exercise hook tampering on both prepare attempts, including a failing worker and unsuccessful restoration.
4. **Must 4:** Add the circuit-breaker review lens and reusable retry-security testing pattern to the scoped guidance.

Implement in that order, with the reader correction and guard landing together so the new gate is green. Deliver one bounded prevention change; no deployment or live worker launch is needed. The preparation remains subject to the runner's independent parked review before implementation.

## Test plan

- we:skills-src/conveyor/__tests__/build-dispatch-daemon.test.mjs: observe route and dispatch arguments on both ticks, partial/full releases, explicit-policy precedence, and real reader behavior against temporary files.
- we:scripts/__tests__/check-standards-rules-scorecard-reads.test.mjs (planned): rejected literal/resolved-path reads, aliased bindings and namespace reads; accepted store API calls, comments, unrelated JSON, fixtures, owner and explicit migration exception. Include the current daemon bypass as a failing fixture.
- we:scripts/__tests__/check-standards.test.mjs: prove the production gate invokes the scanner and reports a planted violation, rather than testing only a standalone helper.
- we:scripts/operations/__tests__/probation-build-run.test.mjs: attempt-indexed tampering matrix with call ordering, worker counts, no second stamp after tampering, no commit/PR, and no discard when restoration fails. Retain the successful two-attempt repair control.

## Proof plan

Run the four scoped Vitest suites and the standards gate from the WE checkout. During implementation, demonstrate each new guard's sensitivity: suppress release refresh on tick two, restore the original raw reader, and move the hook check outside the repair loop in separate temporary mutations. Each relevant new test must fail, then pass after restoring the intended implementation. The raw-reader mutation must also fail the standards gate. Record commands, outcomes, and the actual scanner hit inventory in this card; do not substitute a claimed cause for an observed failure. Use isolated fixtures and never launch a provider or touch shared scorecards for proof.

## Done when

1. **Must 1:** The daemon suite fails when tick two cannot observe a valid reset and passes with the existing release path intact.
2. **Must 2:** The scanner and gate suites reject the original raw-reader shape, the daemon uses the supported store API, and `npm run check:standards` passes on the corrected implementation.
3. **Must 3:** The probation suite fails when repair-attempt hook inspection is removed and passes with both attempt indices protected.
4. **Must 4:** The scoped review/testing guidance names the reset-path evidence and attempt-indexed security pattern, and the independent reviewer can trace them to the new tests.

## Follow-ups

No follow-up is required to complete these three debts. Broader interprocedural filesystem analysis and new automatic circuit-breaker recovery policy are outside this item. If the bounded scanner inventory exposes additional production bypasses, report their exact owners and expand scope with matching tests before implementation; do not suppress unexplained hits or silently broaden exemptions.
