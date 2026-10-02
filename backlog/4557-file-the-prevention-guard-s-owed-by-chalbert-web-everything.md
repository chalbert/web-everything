---
bornAs: xrd8nx3
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/operations/minimal-context-provider.mjs", "we:scripts/operations/explore-io.mjs", "we:scripts/operations/dispatch-lane-io.mjs", "we:scripts/operations/__tests__/minimal-context-provider.test.mjs", "we:scripts/operations/__tests__/explore.test.mjs", "we:scripts/operations/__tests__/dispatch-lane.test.mjs", "we:scripts/operations/__tests__/deliver-item-wrapper.test.mjs", "we:scripts/operations/__tests__/minimal-context-provider-model-guard.test.mjs", "we:scripts/operations/__tests__/explore-io*.test.mjs", "we:scripts/operations/__tests__/dispatch-lane-io*.test.mjs"]
dateOpened: "2026-09-29"
preparedDate: "2026-10-02"
preparedAgainstSha: "a14570913daa49462b55b2a7d27729c04b286fa4"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3007's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval"). Preserve the review's goal: require an explicit resolved model for fresh restricted workers, prevent fresh Claude launch sites from silently inheriting a model, and enforce the existing Fable refusal consistently across dispatch branches.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3007@d084d02f01208aaf493e836f2c4093ad9036beed

## Progress

Preparation research (no implementation or stamping):

- **Old premise/scope:** the review cited we:scripts/operations/minimal-context-provider.mjs:181, we:scripts/operations/explore-io.mjs:359, and we:scripts/operations/dispatch-lane-io.mjs:2219. It proposed mandatory model input, a repo-wide argv guard or shared builder, and shared Fable enforcement. Scope named nonexistent we:scripts/operations/__tests__/explore-io.test.mjs and we:scripts/operations/__tests__/dispatch-lane-io.test.mjs.
- **Corrected premise:** `buildRestrictedProviderArgv` at we:scripts/operations/minimal-context-provider.mjs:172 still defaults `model` to Sonnet. `buildInvestigatorArgv` at we:scripts/operations/explore-io.mjs:359 emits no model unless supplied in `extraArgs`; its separate `defaultSpawnAgent` at we:scripts/operations/explore-io.mjs:522 performs no model validation. There is no single shared default spawner: dispatch has another at we:scripts/operations/dispatch-lane-io.mjs:1812.
- **Partial prior implementation:** `buildAgentArgv` at we:scripts/operations/dispatch-lane-io.mjs:2241 already rejects an unresolved fresh model and resolves launch-kind routing. However, its no-table fallback bypasses `resolveWorkerModel` at we:scripts/operations/dispatch-lane-io.mjs:2368, whose Fable check currently applies only to a reasoned override. The resume return at we:scripts/operations/dispatch-lane-io.mjs:2264 deliberately omits model flags; a blanket '--bg requires --model' rule would be wrong.
- **Observed evidence:** importing and invoking the three actual builders without starting a worker produced: restricted omitted model → `sonnet`; exploration omitted model → no `--model`; dispatch with no table, `--model fable`, and a reason → emitted `fable`. This debt is not already delivered.
- **Corrected scope:** retain the three source files, replace the two nonexistent tests with we:scripts/operations/__tests__/explore.test.mjs and we:scripts/operations/__tests__/dispatch-lane.test.mjs, and include we:scripts/operations/__tests__/deliver-item-wrapper.test.mjs because it also calls the restricted builder without a model. Add planned we:scripts/operations/__tests__/minimal-context-provider-model-guard.test.mjs for the repo-wide prevention contract. The production restricted caller already forwards `model` at we:scripts/operations/deliver-item-wrapper.mjs:1073; its source does not need changing merely to make the builder argument mandatory.

- **Validation repair:** retain the existing integration test scope and add planned matching IO contract tests under we:scripts/operations/__tests__/explore-io*.test.mjs and we:scripts/operations/__tests__/dispatch-lane-io*.test.mjs. The existing suites are named we:scripts/operations/__tests__/explore.test.mjs and we:scripts/operations/__tests__/dispatch-lane.test.mjs; the matching IO test patterns describe planned coverage, not existing files.

## Design

1. Remove the restricted builder's implicit model default in we:scripts/operations/minimal-context-provider.mjs. Require a nonempty, non-option string for a fresh launch before alias conversion; retain the existing resume shape and inherited model. Update direct fresh-call fixtures to supply their intended model. Preserve effort, tools, settings and directory grants.
2. In we:scripts/operations/explore-io.mjs, validate the explicit model supplied through `extraArgs` before returning fresh argv and at the default spawner boundary. Accept the existing model flag spellings (`--model`, `-m`, `--model=`); reject missing, blank or option-shaped values before exec. Do not invent a panelist tier or silently supply a new fallback. Use the existing clean refusal convention so the sink reports a launch that did not happen.
3. In we:scripts/operations/dispatch-lane-io.mjs, make both fresh dispatch branches pass through the same final model validation, including case-insensitive Fable refusal. Apply it to the selected model whether it came from routing, a table or an explicit flag. Preserve existing table override/reason rules, no-table resolution and alias behavior; this guard is not a change to tier selection or override policy. Validate fresh argv at the default spawner too. Preserve resume argv without injecting a model.
4. Implement the review's repo-wide-test option in planned we:scripts/operations/__tests__/minimal-context-provider-model-guard.test.mjs. Scan production JavaScript modules under we:scripts/ for Claude process-call sites and fresh argv construction (`--bg`, or `-p` with `--session-id`). Maintain an explicit inventory mapping dynamic argv sites to their model-validating builder and executable contract test; fail on unclassified new sites. Check fresh literal argv for a valid explicit model. Classify resume and non-launch commands (`agents`, `auth`, `stop`, `rm`) separately with reasons, never a blanket file exemption. Test the detector on synthetic additions, flag variants, comments and resume cases; do not claim a regex proves arbitrary data flow. This combines the review's overlapping guards into one prevention test without pretending the two default spawners are shared.

## MVP

- Deliver mandatory fresh restricted-model validation, exploration rejection before spawn, and consistent dispatch Fable validation in the three scoped source files.
- Update their existing tests and the restricted caller fixtures; prove an Opus-selected restricted request reaches the injected process boundary as exactly one `--model opus`.
- Add the repo-wide inventory/argv test with explicit classifications for current sites. Existing unrelated launch sites require evidence of their current model contract, not unverified exemptions. If inventory research exposes additional broken producers, record their concrete source/test scope before extending implementation; do not hide failures in an allowlist.

## Test plan

- we:scripts/operations/__tests__/minimal-context-provider.test.mjs: missing, undefined, null, blank and option-shaped fresh models throw; Sonnet and Opus emit one correct model; resume remains unchanged; tools/settings/add-dir flags survive.
- we:scripts/operations/__tests__/deliver-item-wrapper.test.mjs: update direct fresh builder calls and exercise the real restricted provider with injected spawn IO and a routed Opus model; assert the model reaches argv without starting Claude.
- we:scripts/operations/__tests__/explore.test.mjs: valid flag forms reach injected exec; absent/invalid models fail before exec; default provider/sink preserves clean refusal semantics and existing timeout/settings behavior.
- we:scripts/operations/__tests__/dispatch-lane.test.mjs: Fable and mixed-case Fable fail with and without an explicit table, with and without a reason; also reject a table-selected Fable. Valid resolved models still emit exactly one flag. Test direct default-spawner bypass attempts and preserve resume byte shape, environment sanitization and trust retry behavior.
- Planned we:scripts/operations/__tests__/explore-io*.test.mjs and we:scripts/operations/__tests__/dispatch-lane-io*.test.mjs: place focused builder and direct default-spawner model-validation assertions in these matching IO contract suites; retain provider/sink integration coverage in the existing exploration and dispatch suites above.
- Planned we:scripts/operations/__tests__/minimal-context-provider-model-guard.test.mjs: scan current production sites; mutation fixtures add an unclassified spawn, remove a fresh model, and add a dynamic builder bypass. Each must fail. Valid fresh flags, documented resumes and non-launch commands pass.

## Proof plan

Before implementation, run the new behavioral assertions against the current builders and capture the expected failures corresponding to the three observed gaps. After implementation, run the affected Vitest files listed above and the repo-wide prevention test, recording command, exit status and assertion totals. Invoke Vitest from the WE checkout with the listed `we:` prefixes removed from filesystem arguments. Run `npm run check:standards` at implementation completion. Preparation checks and stamping belong to the runner.

Use injected process IO to prove refusals occur before execution and to capture complete allowed argv. Do not launch paid workers or claim provider execution was verified from argv tests. This changes validation on existing paths, not a new dispatch mechanism.

## Done when

All existing and planned scoped test files pass, the new regression assertions fail against the pre-change builders, and the repo-wide test detects a newly introduced unclassified or model-less fresh launch. Fresh restricted calls require a model, exploration cannot spawn without one, dispatch refuses Fable in both branches, and resume behavior remains covered and unchanged.

## Follow-ups

No new model selection policy is required for these guards. Keep any newly discovered launch producer's repair explicit with its matching test scope; preserve the original goal rather than exempting it silently. Broader consolidation of all Claude spawning into one process abstraction is outside this item. Do not migrate resume semantics or expand this work into provider selection changes.
