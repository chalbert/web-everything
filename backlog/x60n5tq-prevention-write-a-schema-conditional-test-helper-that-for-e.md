---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:contracts/plateau-progress-view.test.ts", "we:contracts/plateau-progress-view.schema.json", "we:contracts/plateau-progress-view.examples.json"]
dateOpened: "2026-10-01"
preparedDate: "2026-10-02"
preparedAgainstSha: "0a8d2dfd70a2a4d2bdbe496662a8012f5caf0144"
tags: []
---

# Prevention — Exercise health schema conditionals independently and keep examples consistent

Filed mechanically on approval of chalbert/web-everything#3386. Preserve the original prevention goal: prove conditional explanation requirements independently, distinguish consumer invariants from schema validation, and prevent health examples from contradicting those invariants.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3386@e2667789e8948aa08d72630ad7b31111667ac3f0

## Progress

- Original premise/scope: the three scoped contract files needed nullable-field rejection tests, explanation tests, stop-state clarification, example consistency, and possible generic mutation/prose/coverage lint gates. Historical references to test lines 151/158 and schema line 2900 did not identify the current conditional definitions precisely.
- Corrected premise: null evidence is legal **with an explanation**. The missing test is rejection with `reason: null` while exactly one conditional trigger is active, not blanket rejection of nullable values. An Ajv probe of `healthPause` accepted a complete observed baseline with null reason, rejected only `paused: null` with null reason, and accepted that same null field with a nonempty reason.
- Current evidence: `we:contracts/plateau-progress-view.test.ts:157` tests an empty explanation, which already fails the base string constraint; `we:contracts/plateau-progress-view.test.ts:167` tests null reason on a pending overnight row with other null evidence, so it cannot prove each trigger independently. The health suite beginning at `we:contracts/plateau-progress-view.test.ts:107` has no independent conditional-trigger matrix. Later provenance and PR suites do not deliver that missing health coverage.
- Schema evidence: `healthFreshness` at `we:contracts/plateau-progress-view.schema.json:1668` and eight observed-status health definitions use conditional explanation guards. `healthOvernight` begins at `we:contracts/plateau-progress-view.schema.json:2805`; its stop/running prose is not a state-classification conditional. The health description at `we:contracts/plateau-progress-view.schema.json:3203` explicitly leaves temporal comparisons, joins, and arithmetic to consumers.
- Fixture evidence: inspection of all four health examples in `we:contracts/plateau-progress-view.examples.json` found `health-stale` labels stop/running as observed; `health-conflict` and `health-stop-pending` label expired budget windows and old daemon completions as observed. The stale example already labels the daemon row stale despite fresh heartbeat/source freshness; these statuses describe distinct evidence and must not be conflated.
- Corrected scope remains the three existing files. `we:contracts/plateau-progress-view.test.ts` is the matching existing test file for both `we:contracts/plateau-progress-view.schema.json` and `we:contracts/plateau-progress-view.examples.json`, and hosts/tests the proposed local helper itself. Bound the prevention mechanism to this contract; generic repository lint infrastructure is follow-up work. No runtime implementation or new classification policy is needed.

## Design

Add a local table-driven helper in `we:contracts/plateau-progress-view.test.ts`. Compile definition validators with the shared definitions, using the existing Ajv options. Supply explicit valid neutral baselines for `healthFreshness`, `healthRemediation`, `healthEscalation`, `healthEpisode`, `healthPause`, `healthDaemon`, `healthBudgetCoverage`, `healthBudgetWindow`, and `healthOvernight`. Nested objects must independently validate; baseline status is fresh/observed, reason is null, and every evidence field named in the conditional is non-null.

Maintain an explicit expected trigger manifest, checked against each definition's `allOf` conditionals. This guards against silently shrinking the tests when a schema branch disappears. For each nullable-evidence trigger, clone the baseline, change only that field to null, and require an Ajv error at the local reason property from the conditional consequence. Then supply a nonempty reason and require acceptance. For each non-neutral status enum value, change only status and perform the same rejected/accepted pair. Assert the neutral baseline passes first. Nulling reason alone on a complete observed/fresh baseline must remain valid. Do not infer that every nullable property is a trigger: freshness cadence fields, for example, are not in that definition's condition.

Cover the three health collection definitions separately: null rows must reject fresh status, complete true, or null reason independently, starting from an otherwise valid unavailable/incomplete/explained collection. Empty arrays remain valid evidence. Keep malformed timestamps and empty-string tests as format tests, separate from these conditional-presence cases.

Clarify `healthOvernight` in `we:contracts/plateau-progress-view.schema.json`: stop/running classification is a consumer responsibility; structural validation alone can accept that combination with observed status and explanatory evidence. Add an explicit acceptance test documenting that boundary, preserving raw unknown mode/state codes. This follows the existing health consumer-responsibility statement rather than adding a runtime policy validator.

Add a fixture-only consistency checker in `we:contracts/plateau-progress-view.test.ts` for every health example in `we:contracts/plateau-progress-view.examples.json`. Use the snapshot's fixed observation time, never the wall clock. Check known stop/running evidence with nonempty job scope is pending/conflict; an expired reset without a later response is stale; and unpaused daemon completion evidence older than a known stale threshold produces a stale row. Preserve independent heartbeat/source freshness. Skip comparisons whose required evidence is null; do not invent freshness or classify unknown raw state codes. Correct the three inconsistent examples and their reasons without changing their distinguishing scenarios.

## MVP

1. Add the nine neutral definition baselines, explicit trigger inventory, and helper in `we:contracts/plateau-progress-view.test.ts`; exercise every existing conditional alternative individually.
2. Add collection-null cases and table-driven non-fresh/non-observed explanation cases, including fresh/observed acceptance controls and explained-null acceptance controls.
3. Clarify the consumer boundary in `we:contracts/plateau-progress-view.schema.json` and lock it with a structural acceptance test.
4. Add the deterministic health-example checker and repair `health-stale`, `health-conflict`, and `health-stop-pending` in `we:contracts/plateau-progress-view.examples.json`. No new files, dependencies, or runtime behavior.

## Test plan

- In `we:contracts/plateau-progress-view.test.ts`, assert each neutral baseline validates before mutation and each rejection identifies the expected reason property/conditional constraint. Use null, not a format-invalid stand-in, for presence cases.
- Exercise every status enum alternative and every nullable trigger independently; verify manifest/schema agreement so a removed branch fails coverage instead of removing its own test.
- Test the helper's sensitivity with in-memory schema clones that remove one trigger or its consequence. The corresponding negative case must become accepted by the weakened validator, demonstrating that the unchanged schema rejection depends on that conditional. Do not edit the on-disk schema for mutation probes.
- Test the example checker with valid controls and cloned fixtures violating each invariant in isolation. Include missing evidence, unknown raw codes, paused daemon evidence, threshold equality versus strictly older completion, and a later response after an old reset. Keep these assertions limited to documented comparisons; no interpretation of unknown codes.
- Run the focused Vitest suite for `we:contracts/plateau-progress-view.test.ts`, retaining existing schema-1, schema-2, provenance, and PR coverage. Run `npm run check:standards` after implementation.

## Proof plan

First add the example-consistency assertions and run the focused suite against the current fixtures: the named inconsistent examples must fail for their specific invariant. Correct the fixtures, then rerun the same suite to green. Capture failing example names and diagnostics, followed by the passing result.

For conditional prevention, capture the valid baseline, rejection with exactly one trigger, acceptance after adding reason, and acceptance under the deliberately weakened in-memory schema. Every manifest entry must have a corresponding result; aggregate test counts alone do not prove independent coverage. Record the standards-gate result and verify the final implementation diff stays within the three scoped files. Preparation itself changes only this card; the runner owns stamping and checks.

## Done when

- Must reject unexplained health evidence for every independently activated existing conditional trigger, while accepting neutral and explained-null controls.
- Must expose removal of an individual trigger through the explicit coverage manifest and targeted sensitivity checks.
- Must document and test the structural-validator/consumer boundary without tightening raw mode/state vocabularies.
- Must pass deterministic consistency checks for every supplied health example; the new checks must demonstrably fail against the original inconsistent fixtures and pass after correction.
- Executable evidence is the focused Vitest run for `we:contracts/plateau-progress-view.test.ts` plus `npm run check:standards`, with the red/green and mutation evidence described above.

## Follow-ups

Generalizing the local helper into a repository-wide conditional coverage gate, adding schema mutation tooling to `check:standards`, detecting format-invalid substitutes through static test lint, and parsing invariant prose for enforcement/exemption are separate extensions. The original review listed these as broader prevention mechanisms; this MVP provides deterministic coverage for the affected contract without pretending a prose parser can decide consumer policy. Extract shared infrastructure only with additional concrete contract cases and a separately scoped test plan.
