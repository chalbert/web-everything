---
bornAs: xt2d1zj
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/operations/probation-build-run.mjs", "we:scripts/operations/__tests__/probation-build-run*.test.mjs", "we:scripts/check-standards.mjs", "we:scripts/__tests__/check-standards.test.mjs", "we:scripts/lib/probation-prevention-check.mjs", "we:scripts/lib/__tests__/probation-prevention-check.test.mjs"]
dateOpened: "2026-09-29"
preparedDate: "2026-10-02"
preparedAgainstSha: "df78eef6655e73cff3c5b98fe14fefa52379059e"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3009's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval"). Preserve the original four prevention debts: model hand-off parity, critical-work refusal at the launcher boundary, production scorecard lock/migration coverage, and static undefined/use-before-definition checks. Approval did not discharge these guards.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3009@0e0a0986875cca3f8b1ebed4e2db344d3808d234

## Progress

Preparation research corrected the original premise against the acquired checkout:

- **Old model premise:** derive one parser allowlist from all Claude tiers plus Gemini, citing we:scripts/operations/probation-build-run.mjs:165. **Current evidence:** `parseArgs` in we:scripts/operations/probation-build-run.mjs:198 delegates model resolution to `resolvePolicyModel`; full worker JSON is a dispatcher hand-off, while bare worker IDs and explicit model flags retain narrow operator-pin restrictions. The regression at we:scripts/operations/__tests__/probation-build-run.test.mjs:1020 explicitly refuses an operator-pinned Opus model. Corrected scope is parity for dispatcher hand-offs and removal of duplicated model literals without broadening operator pins. `selectProbationWorker` and the shared model constants live in we:scripts/lib/provider-routing.mjs:379 and we:scripts/lib/provider-routing.mjs:145.
- **Old critical-work premise:** machinery paths and critical work share one denylist, with a launcher check at we:scripts/operations/probation-build-run.mjs:343. **Current evidence:** we:scripts/lib/critical-work.mjs defines the narrower gate/approval boundary and explicitly excludes ordinary machinery from blanket critical classification; we:scripts/lib/__tests__/critical-work.test.mjs:310 preserves the ordinary tick-core counterexample. The build runner imports neither this verdict nor the machinery roster. Its card-owned scope is established at we:scripts/operations/probation-build-run.mjs:385. Corrected guard uses the current classifier, refusing critical machinery rather than every machinery path. Prepare mode edits the card, not the implementation scope it describes.
- **Old scorecard premise:** production adapter located at we:scripts/operations/probation-build-run.mjs:616. **Current evidence:** `realIo().appendScorecard` is at we:scripts/operations/probation-build-run.mjs:892 and passes `requireLock: true`, catching and logging refusal. `ensureMigrated` and `appendRowToStore` in we:scripts/conveyor/run-scorecard-store.mjs already propagate required locking. Existing tests at we:scripts/operations/__tests__/probation-build-run.test.mjs:647 and we:scripts/operations/__tests__/probation-build-run.test.mjs:671 cover concurrent direct store appends and the lock primitive, respectively, not the production adapter with lazy migration. The remaining debt is integration coverage, not a speculative store rewrite.
- **Old scope:** only the runner and its main test. **Corrected scope:** retain those, permit a dedicated runner integration test via the narrow matching pattern, and add a standards-gate integration plus a focused static checker and their matching tests. Searches of we:scripts/check-standards.mjs and we:scripts/check-standards-rules.mjs found no `no-undef` or `no-use-before-define` rule. The existing TypeScript dependency in we:package.json supplies a parser/compiler API without adding packages. Shared routing, classifier, and scorecard modules are read-only dependencies of this item.

This is not already delivered: the runner still lacks the critical-work call and the required production-adapter regression is absent. This preparation changes no runtime policy.

## Design

1. **Model parity:** exercise actual `selectProbationWorker` outputs through full-JSON `parseArgs` hand-offs for task types the runner accepts. Build the fixtures from the current roster and shared model constants, including both Claude tiers and Gemini. Rotate candidates through scorecard/veto inputs so every eligible worker is selected, rather than testing only the default winner. Keep the existing policy-model resolver authoritative for dispatcher routes. Replace duplicated Sonnet/Gemini literals in the explicit-pin branch with the corresponding shared constants; do not admit every Claude tier as an operator pin. Retain prepare restrictions, unknown-model refusal, and Gemini's simple-only/Codex-checker constraints. The selector also serves task types this runner does not accept; those are not parser-parity failures.
2. **Critical scope:** in `runProbationBuild`, classify the original card-owned scope with `criticalWorkVerdict` before launching a non-document worker (`bugfix` and `test-fix`). Pass declared risk/tags if present in the parsed card; do not substitute the lease scope for the card's authorization. Refuse critical or unknown scope with executor `none`, no worker/checker/PR/scorecard, and normal cleanup. Prefer placement before claim so refusal needs no rollback. Preserve existing doc-fix protections and prepare's card-only behavior. Do not import `DISPATCH_MACHINERY_PATHS` as an additional veto.
3. **Production adapter regression:** invoke `realIo().appendScorecard` with a valid launch row in an isolated child process. Point the process's default conveyor state root at a temporary directory and provide a temporary module/repository fixture containing a real legacy scorecard source. Keep real adapter, migration, append, and lock code; do not inject `path` or `write` into the store, since that bypasses lazy migration. Hold a real, non-stale lock owned by a live process. Assert the adapter's logged refusal and byte-for-byte unchanged shared and legacy files, including migration stamps. A second fresh process after lock release must migrate and append successfully, proving that the blocked fixture actually exercised eligible migration input. No real operator store is read or written.
4. **Deterministic gate:** add we:scripts/lib/probation-prevention-check.mjs and wire it into we:scripts/check-standards.mjs. Use the existing TypeScript compiler API for scoped JavaScript name-resolution/use-before-declaration diagnostics in the runner, with Node/ES module globals configured. Limit reporting to undefined identifiers and lexical use-before-declaration; do not turn this into a general type-check migration. Permit legal hoisted function declarations. Add an AST-based check that the supported non-doc build branch invokes the imported shared classifier and refuses a critical verdict before worker execution; comments or an unused import must not satisfy it. Enroll this launcher explicitly; applying the rule to launchers with different contracts requires separate coverage. Behavioral runner tests remain the authority for actual control-flow refusal.

## MVP

- Update we:scripts/operations/probation-build-run.mjs to consume shared model constants and check critical card scope for bugfix/test-fix before execution.
- Extend we:scripts/operations/__tests__/probation-build-run.test.mjs with selector/parser parity and critical-scope regressions. Put the production-adapter child-process fixture in planned we:scripts/operations/__tests__/probation-build-run-scorecard.test.mjs if keeping it separate improves isolation.
- Implement the focused checker in we:scripts/lib/probation-prevention-check.mjs with we:scripts/lib/__tests__/probation-prevention-check.test.mjs, and wire/test invocation in we:scripts/check-standards.mjs and we:scripts/__tests__/check-standards.test.mjs.
- Preserve existing operator-pin, prepare, doc-fix, scorecard failure-reporting, and review-pending behavior. No scorecard format changes or new routing policy.

## Test plan

- Table-driven parity covers every eligible selector model for supported task types, including tier variants, candidate rotation, full JSON serialization, rejected unknown models, pinned Opus refusal, prepare restrictions, and Gemini checker/simple-only retention.
- Fake-IO runner tests supply a critical gate path such as we:scripts/lib/provider-routing.mjs as card scope with an innocuous lease, then reverse the mismatch. The card controls classification; a lease cannot erase a critical verdict. Assert refusal before worker/checker/commit/PR and no attributed scorecard. Include empty scope, mixed critical/ordinary scope, both supported non-doc task types, and an ordinary machinery counterexample such as we:scripts/conveyor/tick-core.mjs. Retain prepare and doc-fix regressions.
- Production scorecard test covers held lock with preexisting shared and legacy stores; also cover absent shared store so refusal cannot create it during migration. Use process completion/lock ownership rather than timing races. Allow the real lock timeout, clean fixtures in finally, and run the unlocked control in a fresh process because migration state is module-local.
- Static checker fixtures include an undefined name, a lexical declaration referenced too early, legal function hoisting, valid imports/Node globals, a classifier mention only in a comment, an unused import, and removal of the critical refusal. Gate integration proves diagnostics cause a failing standards result.

## Proof plan

Run focused Vitest coverage for the runner tests and both gate/checker test homes listed in scope, then `npm run check:standards`. The runner integration must execute production scorecard code under temporary process-level state roots, with before/after byte snapshots and captured refusal output retained as evidence.

Demonstrate red/green prevention: before the fix the new critical-scope runner case fails; after the fix it passes. In temporary source fixtures remove the classifier invocation, insert an undefined identifier, and insert a lexical use-before-declaration independently; each must make the checker fail. Drop `requireLock: true` only in a disposable copy of the adapter and verify the held-lock integration detects the write. Restore nothing in the working source because mutations stay in temporary fixtures. Record exact commands, exit statuses, and assertion output; passing parser parity alone is not proof that a worker was launched safely.

## Done when

All four original prevention debts have executable coverage: selector/parser hand-off parity with preserved pin restrictions; launcher refusal for the current critical boundary; production scorecard refusal without migration/append writes under contention; and an enforced static name/declaration guard. Focused tests and `npm run check:standards` pass, and the negative controls in Proof plan fail for the intended reason.

## Follow-ups

Generalizing classifier-call enforcement to additional probation launchers is separate work: inventory their task contracts and add per-launcher behavioral tests before enrollment. Any change to operator-pin permissions, the definition of critical work, or scorecard contention policy requires its own decision; none is needed to deliver these guards against the current contracts.
