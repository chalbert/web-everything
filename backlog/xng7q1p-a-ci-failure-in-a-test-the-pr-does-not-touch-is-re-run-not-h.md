---
kind: story
size: 3
status: open
scope: ["we:scripts/operations/ci-heal-pr-dispatch.mjs", "we:scripts/operations/__tests__/ci-heal-pr-dispatch.test.mjs", "we:scripts/operations/__tests__/priority-sync.test.mjs", "we:scripts/conveyor/reconcile-core.mjs", "we:scripts/conveyor/reconcile-pass.mjs", "we:scripts/conveyor/__tests__/reconcile-core.test.mjs", "we:scripts/conveyor/__tests__/reconcile-pass.test.mjs", "we:scripts/conveyor/ci-timeout-rerun.mjs", "we:scripts/conveyor/__tests__/ci-timeout-rerun.test.mjs", "we:scripts/conveyor/__fixtures__/ci-timeout-rerun/**"]
dateOpened: "2026-10-02"
preparedDate: "2026-10-02"
preparedAgainstSha: "566a646a0a000c4b3c0c83111cf01d809e6db314"
tags: []
---

# A CI failure in a test the PR does not touch is re-run, not healed, and never spends the PR heal budget

The reported 2026-10-02 incident is PR #3415: test-shard 2 timed out after 5000 ms in the priority-sync registration/help test while three CI-heals reportedly rebased and re-pushed without repairing it. Treat those incident details as a replay target, not a newly verified live diagnosis. Preserve the goal: eligible unrelated test timeouts get bounded job re-runs without consuming the PR's heal budget; after two re-runs, file a flaky-test card; make the named test's timing realistic without weakening its assertions.

## Progress

- **Original premise/scope:** changing only dispatch and its tests, plus the priority-sync test, could rescue even an already-capped PR. **Correction:** the cap is applied upstream in we:scripts/conveyor/reconcile-core.mjs:1837-1867, while dispatch filters only planned heals in we:scripts/operations/ci-heal-pr-dispatch.mjs:244-245. Extend scope to reconciliation and its tests so eligible capped PRs can reach a distinct mechanical action.
- **Original attribution:** an unchanged failing test file establishes that a PR is unrelated. **Correction:** it establishes only path non-overlap. The named test dynamically imports the operation runner (we:scripts/operations/__tests__/priority-sync.test.mjs:616-623), which itself imports many other modules (we:scripts/operations/run.mjs:29-46). Dependency/config/data effects must also be checked before granting the exception. The reported PR's changed shared helpers therefore require scrutiny during replay; do not predeclare it eligible.
- **Original dispatch scope:** implicitly the PR's own files. **Correction:** item attribution can return declared card scope without fetching the diff (we:scripts/conveyor/pr-work-unit.mjs:120-132). Obtain a complete, head-bound PR diff separately; even reconciliation's exposed file list explicitly falls back to null at 100 files (we:scripts/conveyor/reconcile-pass.mjs:1039-1041).
- **Budget correction:** completed trusted heal-marker comments are counted, not every dispatch invocation (we:scripts/conveyor/ci-heal-mark.mjs:40-59). Preserve existing markers and their count; never refund or delete the three reported heals.
- **Test correction:** the named test imports and inspects registration/help metadata; it does not spawn a help subprocess (we:scripts/operations/__tests__/priority-sync.test.mjs:616-623). The reported 5000 ms failure is not reproduced by this preparation. Measure the cold import before choosing its explicit bounded timeout.

## Design

Proposed behavior, grounded in the existing entry points above:

1. Add a read-only evidence enrichment before planning in we:scripts/conveyor/reconcile-pass.mjs:1024-1037, backed by proposed we:scripts/conveyor/ci-timeout-rerun.mjs. Collect repository, PR head, complete changed paths, workflow/run/job IDs, attempt, terminal status, and complete failing-test records (path, full name, timeout kind). Bind logs and diff to the same head. Treat a timeout string without a complete failure inventory as unknown. Require every failing check to be accounted for; mixed assertion/build/infrastructure failures are ineligible.
2. Eligibility requires every failing test to be outside the diff and demonstrably unaffected by changed inputs. Check transitive source imports and test setup; unresolved/dynamic dependency edges stay unknown. Docs, configuration, workflow, dependency/lock files, fixtures and data are not automatically harmless: require evidence they cannot affect the failing tests, otherwise retain normal handling. This is a conservative timeout retry exception, not proof of flakiness.
3. In the CI-red branch, after existing main-red/escalation/liveness safeguards but before the heal cap (we:scripts/conveyor/reconcile-core.mjs:1837), emit a separate mechanical timeout-rerun action. Consume it in we:scripts/operations/ci-heal-pr-dispatch.mjs before queue admission/lane allocation (currently we:scripts/operations/ci-heal-pr-dispatch.mjs:263-298). It must work at zero free lanes and at an already-spent heal cap. Keep other repair and review precedence intact. Preserve the existing main-red recovery path: it needs a new tree, unlike this same-head retry (we:scripts/conveyor/ci-red-recovery-watch.mjs:10-19).
4. Revalidate head and job state immediately before requesting a failed-job re-run through an injectable, repository-explicit effect. Persist a separate restart-safe reservation/outcome keyed by repo, PR, head, run and job attempt; concurrent ticks must not repeat a request. Count at most two confirmed retry requests per head/failure signature, never heal markers. Pending/ambiguous API responses require reconciliation against observed attempts before another request. Failed API requests consume no successful retry count and must not fall through to agent healing on that tick.
5. Once the second re-run is confirmed requested, owe exactly one flaky-test follow-up card containing test identity, logs, head, attempts and the observed outcome (do not claim a passing retry proves flakiness). Reuse the existing card-filing surface described in we:scripts/operations/file-item-io.mjs:3-5; persist and retry failed filing independently. After both re-runs, a still-red eligible failure is surfaced as exhausted with that card reference, without an automatic heal or a third re-run. A passing run clears the wait; a new head needs new evidence and a fresh retry allowance. Never erase historical heal counts.
6. Keep the real registration/sink/help assertions at we:scripts/operations/__tests__/priority-sync.test.mjs:618-622. Measure cold runner import under shard-like load, then assign a documented finite timeout to this integration-style test only. Do not replace it with a mocked registration or increase the global timeout.

## MVP

Implement the evidence reader/classifier, durable retry state and injected effects in the proposed helper; wire enrichment, planner routing and dispatch; retain existing healing for ineligible failures. Include the bounded priority-sync test adjustment, two-retry follow-up filing, and operator-visible refusal reasons. No broad runner lazy-loading refactor, global timeout change, historical budget rewrite or changes to shared agent docs. The expanded scope includes all production seams, unit/integration tests and sanitized replay fixtures; the new helper/test/fixture paths in scope are proposed, not existing files.

## Test plan

- In we:scripts/conveyor/__tests__/ci-timeout-rerun.test.mjs (proposed), use sanitized logs/diffs under we:scripts/conveyor/__fixtures__/ci-timeout-rerun/** (proposed): eligible outside-diff timeout; direct or transitive changed source; changed setup/config/docs/data/fixture; incomplete or truncated logs/diffs; unknown dependency edges; renamed paths; mixed failure kinds; wrong repo/head/run; duplicate names in different test files.
- Extend we:scripts/conveyor/__tests__/reconcile-core.test.mjs and we:scripts/conveyor/__tests__/reconcile-pass.test.mjs to prove evidence survives enrichment and the exception precedes the heal cap while existing escalation, main-red and live-agent guards remain effective.
- Extend we:scripts/operations/__tests__/ci-heal-pr-dispatch.test.mjs: capped PR and zero lanes still re-run; no heal dispatch or marker/count change; two ticks/restarts/concurrent ticks do not duplicate effects; pending/ambiguous writes reconcile; second retry files once; filing failure remains owed; third retry refuses; new head invalidates old evidence. Check both zero and three existing heal markers.
- Run the original priority-sync registration/help test cold and with its affected suite; preserve all assertions and record measured duration against the selected finite timeout.

## Proof plan

1. Before implementation, add the eligible/capped-PR regression to the existing dispatch suite and show it fails because current reconciliation refuses at the cap. After implementation, run `npx vitest run we:scripts/operations/__tests__/ci-heal-pr-dispatch.test.mjs we:scripts/operations/__tests__/priority-sync.test.mjs we:scripts/conveyor/__tests__/reconcile-core.test.mjs we:scripts/conveyor/__tests__/reconcile-pass.test.mjs we:scripts/conveyor/__tests__/ci-timeout-rerun.test.mjs` with the `we:` locus prefixes stripped from command arguments in the WE checkout.
2. Capture PR #3415's actual historical head/diff, failed run/job logs and trusted heal markers read-only. Replay them through the same enrichment → planner → dispatcher with recorded effects. If evidence implicates a changed dependency, prove refusal and report the incident assumption disproved; do not tune the classifier to force eligibility. Also retain a fully evidenced eligible replay to prove the intended success case.
3. In a controlled test PR, observe the real same-head failed-job re-run, unchanged heal count, two-request limit and single follow-up card. Capture before/after head, run attempts, action records and card ID. Unit mocks alone do not demonstrate GitHub effect delivery; no production re-run or card filing is part of this preparation.
4. Run `node we:scripts/verify-lane.mjs` and `npm run check:standards` in the implementation checkout (strip the command's `we:` prefix). Record actual results rather than inferring success from code inspection.

## Done when

- **Executable:** the regression and verification commands in Proof plan pass after demonstrating the capped eligible case fails before implementation.
- **Must on error:** incomplete evidence, stale head, API failure or uncertain side-effect outcome refuses the retry exception with an explicit reason; never assumes a timeout is unrelated or silently dispatches a heal after a failed retry request.
- **Must for all inputs:** source, docs, configuration, dependencies, workflow, setup, fixtures and data changes receive the same impact scrutiny; unchanged test paths alone do not qualify.
- Eligible re-runs spend zero heal budget, require no agent lane, stop after two, and file exactly one follow-up even across restarts. The named priority-sync test retains its real registration/help/sink assertions.

## Follow-ups

- Put measured import timings, any discovered transitive coupling, and any log-parser limitations in the resulting flaky-test card. Broader runner-import optimization is separate work if measurements justify it.
- Preserve a sanitized #3415 replay and report whether its original unrelated-failure premise held. Do not turn an unverified anecdote into a permanent automatic exemption.
- Keep testing lessons in this card or its follow-up; do not append to shared agent documentation in this job.
