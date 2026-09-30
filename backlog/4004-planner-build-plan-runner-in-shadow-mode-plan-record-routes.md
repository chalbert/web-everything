---
bornAs: xacbhmg
kind: story
size: 5
parent: "3383"
status: open
blockedBy: ["3996", "4003"]
dateOpened: "2026-09-23"
preparedDate: "2026-09-30"
preparedAgainstSha: "7e285f7519d5acf81b6b3042a12a6417f4f3c88b"
tags: []
scope:
  - "we:scripts/operations/deliver-item-wrapper.mjs"
  - "we:scripts/operations/plan-runner.mjs"
  - "we:scripts/operations/plan-record-store.mjs"
  - "we:scripts/lib/plan-policy.json"
  - "we:scripts/operations/__tests__/deliver-item-wrapper.test.mjs"
  - "we:scripts/operations/__tests__/plan-runner.test.mjs"
  - "we:scripts/operations/__tests__/plan-record-store.test.mjs"
---

# Planner build: plan runner in shadow mode (plan, record routes, then the single worker)

Child 3 of #3922. Add the planner build's shadow runner to `deliverItem`: plan, validate, record each step's routing recommendation, then run the existing single worker. Single-file cards get a code-built one-step plan without a planner call; a card's `deliveryAgent` marker skips planning. Settings belong in proposed `we:scripts/lib/plan-policy.json`, with `planBuild: shadow` by default. Authority: `we:docs/agent/platform-decisions.md:5533` (#planner-build-plan-and-execute), especially clauses 1–2 and 9 at lines 5538–5544 and 5567–5571.

## Progress

- **Old premise/scope:** the seed named `deliverItem` and a policy file, but declared no scope, persistence seam, dependency interfaces or tests. The goal remains shadow planning followed by the single worker.
- **Observed current code:** the integration home is `we:scripts/operations/deliver-item-wrapper.mjs:320`; acquire/claim precede the worker at lines 409–441, and `runAgentToCompletion` is called at lines 464–466. The detached CLI actually calls this wrapper at `we:scripts/operations/deliver-item-run.mjs:180`; stale prototype comments are not evidence that it is unwired. A search of the scripts tree found no `planBuild` setting or plan-policy file; the similarly named build-dispatch planner is admission scheduling, not this feature (`we:scripts/conveyor/build-dispatch-policy.mjs:198`). This goal is not already delivered.
- **Corrected scope:** add a runner, a small plan/route sidecar store, settings and their tests, plus wrapper integration and its existing tests. All proposed files are listed in frontmatter; no implementation is part of this preparation. Reuse the existing contracts, rather than absorbing the changes owned by the two blockers.
- **Contract drift still pending in blockers:** current planner JSON declares `taskType` (`we:scripts/lib/dispatch-supervisor-contract.mjs:12–19`); current explicit LOC routes are stamped `sizeSource: card` (`we:scripts/lib/dispatch-contracts.mjs:1183–1187`). #3996 must supply the prepared replacements. #4003 must split the existing supervisor ladder (`we:scripts/lib/dispatch-contracts.mjs:626–638`). Do not implement against these old behaviors.

## Design

1. **Integration and inputs.** Add proposed `runShadowPlan` in `we:scripts/operations/plan-runner.mjs`, called after claim and before the worker in `we:scripts/operations/deliver-item-wrapper.mjs:441–464`. Inject planner invocation, routing inputs, clock and persistence for testing; supply production implementations by default. Resolve the card with the existing loader/find-item seam (`we:scripts/operations/dispatch-lane-io.mjs:977–1009`), reading the actual marker rather than inferring it from the selected worker provider. Read brief, acceptance, declared scope, size, tags/risk and source commit from the resolved lane. Preserve repo prefixes in plan identity and paths; reject paths escaping the declared scope. Reuse the wrapper's locus resolution (`we:scripts/operations/deliver-item-wrapper.mjs:372–381`).
2. **Mode boundary.** Proposed policy declares `off | shadow | on`, default `shadow`. `off` skips planning; a marker skips it regardless of mode. Unknown or malformed configuration produces a diagnostic and cannot enable execution. `on` remains an explicit unsupported-mode refusal in this slice: step execution is #4008, and flipping the setting still requires ratification (statute at `we:docs/agent/platform-decisions.md:5567–5571`). Do not silently pretend an `on` request executed steps. Shadow planner timeout, invalid output or route refusal is recorded as observation failure, followed by the existing worker, never a partial step execution. Bound the planner call with a policy timeout (initial proposed value: 120 seconds); do not retry indefinitely.
3. **Plan construction.** Exactly one distinct concrete declared file yields one code-built task; a directory or glob is not evidence of one file. Use card-derived size/LOC for this shortcut and record its code origin; do not invent a model invocation or planner trust success. Otherwise request one JSON plan through the planner role supplied by #4003. Use `PLAN_OUTPUT_SCHEMA`, context-packet validation and `planFromSupervisorOutput` (current seams: `we:scripts/lib/dispatch-supervisor-contract.mjs:19`, `:53–62`, `:83–112`). Reject mismatched story identity, malformed profiles, duplicate IDs, unknown dependencies and cycles; the last three already have checks in `we:scripts/lib/dispatch-contracts.mjs:239–268`. Check file containment and dependency/profile consistency before routing. A model supplies tasks and estimates, never model assignments or authoritative task types.
4. **Dependencies, explicitly prospective.** #3996's prepared interface is the taskType-free planner schema, `taskTypeFor({ cause: 'planned', scopePaths, ... })`, and `decideDispatchRoute` honoring `sizeSource: 'plan'` (`we:backlog/3996-planner-build-plan-schema-and-routing-inputs-task-type-by-ca.md:37–49`). Consume those semantics, with the step's estimated LOC, scope, risk and existing routing records; retain raised risk and the full route audit/refusal. For the code shortcut retain card estimate provenance. #4003 (`we:backlog/4003-planner-build-separate-planner-and-checker-roles-with-their.md:33–48`) supplies the separate planner role/ladder, role-specific trust lookup and supervisor invocation contract: Sonnet below card size 8, Opus at 8+ or high-risk/statute-tier. Pass card size/risk explicitly through that interface, not an arbitrary LOC conversion that changes the threshold. Checker invocation is outside shadow scope. The prepared blockers still permit symbol naming choices; reconcile exact exports when they land, preserving these semantic requirements. A landed interface that contradicts the statute is an escalation, not permission to change this goal.
5. **Invocation and records.** Use #4003's verified invocation posture via `SUPERVISOR_INVOCATIONS` (`we:scripts/lib/dispatch-supervisor-contract.mjs:120–136`); never launch the planner through the editing worker port. An unverified/unavailable backend yields explicit planning failure, not a fabricated successful plan. Proposed `we:scripts/operations/plan-record-store.mjs` atomically writes a versioned sidecar per session/attempt under proposed `we:.operations/build-plans/`, resolved from the item lane, following the root injection and rename pattern at `we:scripts/operations/delivery-report-store.mjs:44–66` and `:101–109`. Include item/session/attempt, base SHA, effective mode, timestamps, plan origin, planner identity when invoked, validated plan, and task-ID-keyed route records (including refusals and audit trails). Mark recommendations as shadow observations: no executed-step vendor, success verdict or qualifying trial is manufactured. Store failure/skip reasons explicitly; persistence failure must be visible in wrapper diagnostics and must not count as a recorded successful shadow run.
6. **Preserve the single-worker arc.** Shadow routes never select the actual worker or launch step lanes/checkers, mutate trust, or run checks per step. Existing gate/retry and converge remain owned by the wrapper (`we:scripts/operations/deliver-item-wrapper.mjs:508–530`). A resumed delivery reuses the prior attempt's record where available, reports missing legacy evidence, and does not replan or spawn a fresh worker; preserve the resume branch at `we:scripts/operations/deliver-item-wrapper.mjs:1403–1410`. #4006 can extend this record with live step states; this card records planned routes only.

## MVP

- Default shadow produces a validated multi-file plan and one durable route observation per task before the unchanged worker runs once.
- A concrete single-file card uses the code path with zero planner calls; marker/off cases use zero planner and step calls, with explicit skip evidence.
- Failure paths record honest diagnostics and preserve shadow's observational boundary. No execution-enabling setting change, step lease, checker, diff application, trial promotion or dashboard ships here.
- Both blocker interfaces are consumed after landing; their contract implementations and tests remain owned by #3996/#4003.

## Test plan

- Proposed `we:scripts/operations/__tests__/plan-runner.test.mjs`: default/missing/invalid settings, explicit off/on, marker precedence, single concrete file versus glob/directory/multi-file, planner size 5/8 and risk/statute cases, malformed JSON, wrong story, duplicate IDs, cycles, unknown dependencies, escaped scope, timeout and refused route. Assert one route per validated task, cause-derived type, estimate provenance and raised risk against the landed #3996/#4003 interfaces. No planner call for the shortcut; no execution/trust mutation for any shadow result.
- Proposed `we:scripts/operations/__tests__/plan-record-store.test.mjs`: round-trip plan plus routes, invalid identities, corrupt JSON, atomic replacement, separate attempts and explicit lane roots. Use temporary directories, never the real pool or operational records.
- Extend `we:scripts/operations/__tests__/deliver-item-wrapper.test.mjs` (existing dependency mocks at lines 40–54): assert ordering claim → plan/record → one worker → existing gate/converge; marker/off bypass, planner failure fallback, visible record-write failure, resume without replanning and unchanged worker provider. Count calls to prove no per-step heavy checks. Tests must exercise the default production wiring with injected IO, not just an unused helper.

## Proof plan

- Run the named suites below and the lane gate after implementation. The new suite paths do not exist in the observed tree; the command must fail before implementation and pass afterward with the named behavioral assertions, not merely empty test files.
- Before considering the production wiring proven, drive one real multi-file shadow delivery and one concrete single-file delivery through `deliverItem`. Capture the planner command/output, persisted plan/route record, worker session and final delivery outcome. Observe that route count equals task count, no step worker/checker/lease started, the one worker retained its provider, and checks ran at the build boundary. The single-file run must show zero planner calls.
- Follow the driver/observer checklist in `we:docs/agent/prototype-based-dev.md:25` onward during implementation: distinguish mocked contract proof from live CLI proof; keep the path on probation until the complete delivery arc is observed. Attach evidence to this card's Progress at implementation time. This preparation performs no dispatch or implementation probe and makes no live-success claim.

## Follow-ups

- #4006 owns live step-state progression/dashboard consumption (`we:backlog/4006-planner-build-live-step-status-record-for-each-build.md:14`); preserve record identity for that extension.
- #4008 owns actual step execution, acceptance and request/resume handling (`we:backlog/4008-planner-build-step-execution-with-verdict-before-commit-and.md:14`). The `on` setting remains ratification-gated.
- Keep fault-injection and live-probe lessons here, including resume and root-resolution failures; do not append shared agent docs during delivery. Shadow recommendations cannot be evidence of successful delegated trials.

## Done when

The behavior above passes these implementation checks from the repository root (executable paths below are shell arguments; prose citations use `we:`):

```bash
test -f scripts/operations/__tests__/plan-runner.test.mjs &&
  test -f scripts/operations/__tests__/plan-record-store.test.mjs &&
  npx vitest run scripts/operations/__tests__/plan-runner.test.mjs scripts/operations/__tests__/plan-record-store.test.mjs scripts/operations/__tests__/deliver-item-wrapper.test.mjs
node scripts/verify-lane.mjs
```
