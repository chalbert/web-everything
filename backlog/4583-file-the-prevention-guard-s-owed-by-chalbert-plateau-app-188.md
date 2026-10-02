---
bornAs: xzecxns
kind: story
size: 3
parent: "4075"
status: open
scope: ["plateau:src/wip/wip-read.test.ts", "we:scripts/operations/delivery-report-record.mjs", "we:scripts/operations/__tests__/delivery-report-record.test.mjs", "we:scripts/operations/__tests__/delivery-report-store.test.mjs", "we:scripts/check-standards-rules.mjs", "we:scripts/__tests__/check-standards-rules-operations-test-pairs.test.mjs", "we:scripts/check-standards.mjs", "we:scripts/__tests__/check-standards.test.mjs"]
dateOpened: "2026-09-30"
preparedDate: "2026-10-02"
preparedAgainstSha: "91d9b89ae899dd70bd0cc1f410917670f5e9ad98"
tags: []
---

# File the prevention guard(s) owed by chalbert/plateau-app#188's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval"). Preserve the review's six obligations: real queue-store corruption coverage, null addedAt coverage, explicit terminal delivery-report validation with a transition matrix, rejection of terminal null outcomes, rejection of successful outcomes without touched files, and an operations-module test-companion gate. The two individual validator regressions belong in the same matrix, not separate implementations.

Idempotency key (do not edit): approval-prevention-key:chalbert/plateau-app#188@7ca974e7c2fb04f5e7ca26dd8a0ffefabdf3a306

## Progress

Preparation research (2026-10-02; WE checkout 91d9b89ae, Plateau App checkout 2e9ae55):

- **Old premise/scope:** the filing attributed WIP to we:src/wip/wip-read.ts:321 and we:src/wip/wip-read.test.ts:473, named a nonexistent we:queue-store.mjs, and included nonexistent we:src/wip/__tests__/wip-read.test.mjs. It scoped the delivery-report store as though the companion-test rule belonged there, without scoping the standards checker.
- **Corrected premise/scope:** WIP belongs to Plateau App. The lane-adjacent Plateau copy at 29db1bb predates the reviewed change; the newer local Plateau checkout at 2e9ae55 contains merge 1888d29 and delivery commit 7ca974e. Current source evidence is plateau:src/wip/wip-read.ts:369-380 (loader), :404-407 (real-store call), and :480 (null normalization). The existing queue suite is plateau:src/wip/wip-read.test.ts:480-547. It uses stub modules and has neither the real corrupt-file case nor an explicit null timestamp case. WIP production code needs no planned change; scope its existing test only.
- **Queue contract evidence:** we:scripts/conveyor/queue-store.mjs:72 (`parseQueue`) and :260 (`readQueueFile`) deliberately return an empty array on corrupt input. A preparation-time Node probe against an isolated temporary file returned `[]` for malformed JSON and retained `{num:'4341', addedAt:null}` for a valid row. Through the current reader, a successful empty store return does not add `conveyor-queue` to degraded sources. This is a compatibility regression test, not a proposal to redefine corruption handling.
- **Validator evidence:** replace the old :132/:137/:159 citations with we:scripts/operations/delivery-report-record.mjs#validateDeliveryReport. A direct Node probe returned `ok:true` for all three invalid terminal records: null outcome plus a nonempty reason; successful outcome plus null files; successful outcome plus empty files. Existing we:scripts/operations/__tests__/delivery-report-record.test.mjs covers valid started/success/blocked records and missing reasons, but not these holes. This goal is not already delivered.
- **Guard scope correction:** we:scripts/operations/__tests__/delivery-report-store.test.mjs already exists. Add semantic read/write regressions there; the store already delegates validation and needs no production edit. Implement the companion rule in we:scripts/check-standards-rules.mjs and wire it in we:scripts/check-standards.mjs, with matching planned pure-rule and existing checker tests listed in scope. The original store citation was the motivation, not the implementation home.

## Design

1. Extend plateau:src/wip/wip-read.test.ts using the existing temporary-root fixture pattern. Its generated queue-module bridge must re-export the actual WE store, using a resolved file URL to we:scripts/conveyor/queue-store.mjs; do not duplicate its parser. Pin `CONVEYOR_QUEUE_FILE` to an existing isolated fixture file and restore environment state after each test. Keep generated importable modules under the suite's existing repo-local cache, because the suite documents Vitest's outside-root import limitation. Create an epic and child card so row assertions cannot pass vacuously. Corrupt JSON produces no queued rows and no `conveyor-queue` degradation; an explicit null timestamp still produces the queued child and a valid snapshot. Missing modules/exports remain degraded as existing tests assert.
2. In we:scripts/operations/delivery-report-record.mjs, enforce a recognized non-null outcome whenever status is `done`, independently of reason. Whenever outcome is `done`, require a nonempty `filesTouched` array whose members satisfy the existing nonempty-string check. Preserve the default started record with null outcome/files, the pure merge behavior, and the existing nonempty reason requirement for blocked/human-judgment terminal outcomes. Do not require touched files for those non-success outcomes. Parsing, assertions, and store writes must inherit the same validator; add no second validation implementation.
3. Add a pure operations test-pair detector in we:scripts/check-standards-rules.mjs, composed by we:scripts/check-standards.mjs. Cover production modules recursively under we:scripts/operations/; exclude test/fixture/helper files inside test directories and test files themselves. Require the same basename's companion in its adjacent test directory (for example we:scripts/operations/delivery-report-store.mjs → we:scripts/operations/__tests__/delivery-report-store.test.mjs). To enforce **new** modules without turning this item into a historic test retrofit, freeze the exact existing unpaired production paths at implementation time in the rule module; no directory wildcards or newly added exceptions. Check all non-exempt module paths on full runs, intersect module candidates with the effective changed-file set on scoped runs, and map a removed companion back to its source so deletion cannot evade the rule. A finding names the source and expected companion and fails the gate. Test existence is the guard's bounded claim; it does not prove meaningful coverage.

## MVP

Deliver the two Plateau reader regressions, the terminal validator checks and table-driven coverage, store-boundary regressions, and the wired operations test-pair rule with tests. No queue API redesign, WIP UI changes, dispatch rollout, broad operations test retrofit, or report schema-version change is needed. The cross-repository test belongs in Plateau App; all validator and guard work belongs in WE. No implementation is performed by this preparation card edit.

## Test plan

- plateau:src/wip/wip-read.test.ts: real-store malformed JSON, a positive real-store valid row control, and explicit null addedAt; assert queued row identity, source-specific degradation, and `validateSnapshot(...).ok`. Stub unrelated shell calls, restore environment variables, and clean every fixture. Do not assert that the entire snapshot is healthy when unrelated sources are intentionally unavailable.
- we:scripts/operations/__tests__/delivery-report-record.test.mjs: table-drive omitted, null, empty-string, unknown, and each valid outcome against omitted, null, empty-array, valid-array, and invalid-member files. Exercise direct records and `applyDeliveryUpdate(newDeliveryReport(...), patch)`. Distinguish deleting a field from omitting a patch field (the latter retains the constructor's null). Include a nonempty reason on invalid null-outcome cases so the existing reason check cannot falsely satisfy the regression. Assert the default started record remains valid and valid blocked/human-judgment terminal records pass with a specific reason and no touched files. Check parse/assert rejection as well as validator errors.
- we:scripts/operations/__tests__/delivery-report-store.test.mjs: rejected writes leave the prior valid report intact; raw on-disk terminal null-outcome and success-without-files records throw on read; valid terminal records round-trip. Use isolated directories only.
- Planned we:scripts/__tests__/check-standards-rules-operations-test-pairs.test.mjs: missing companion fails; exact companion passes; another basename does not satisfy it; nested production modules are covered; test fixtures are excluded; exact grandfathered paths pass while new siblings fail; removed companions remain visible under scoped selection.
- we:scripts/__tests__/check-standards.test.mjs: exercise actual checker wiring with an isolated fixture module lacking its companion, then add its companion and verify the finding disappears. Cover full and scoped selection, including companion removal. The pure detector alone is insufficient proof of gate wiring.

Run the selected suites from their owning repository roots (the `we:` and `plateau:` labels above identify the repository, not literal CLI path syntax):

WE:
```sh
npx vitest run scripts/operations/__tests__/delivery-report-record.test.mjs scripts/operations/__tests__/delivery-report-store.test.mjs scripts/__tests__/check-standards-rules-operations-test-pairs.test.mjs scripts/__tests__/check-standards.test.mjs
npm run check:standards
```

Plateau App:
```sh
npx vitest run src/wip/wip-read.test.ts
```

## Proof plan

Before implementation, capture the terminal-validator counterexamples recorded in Progress. Add the negative assertions first and observe them fail against the old validator; after the fix the same assertions pass. Reader characterization cases may pass immediately: their purpose is to close missing regression coverage, not manufacture a production failure. Use the real-store valid-row control to prove the corruption test actually reaches the store instead of silently failing its import.

For the standards guard, run the actual checker against an isolated new operations module without its matching test and observe the specific missing-companion failure. Add the companion and repeat, observing that finding disappear; remove the companion under scoped selection and observe failure again. Preserve unrelated findings separately rather than calling their presence proof of this rule. Run the listed suites and full standards gate, attach their commands/results to delivery evidence, and inspect the diff for production-scope drift. No live queue, live delivery report, publisher restart, or deployed UI probe is required for these guards.

## Follow-ups

- Retrofitting tests for grandfathered operations modules is separate debt; the frozen list must not grow as part of routine additions.
- Surfacing queue corruption as a distinct degraded state would change the tolerant store contract. This item pins existing behavior and leaves such a policy change to a separate decision.
- Test-companion existence does not establish coverage quality; keep review of meaningful assertions alongside the executable guard.

## Done when

1. The WE selected-suite command above fails on the old terminal validator with the new regressions and passes after the checks land; store reads/writes enforce the same contract.
2. The Plateau selected-suite command passes with both a real corrupt-file case and an explicit null addedAt case, plus a real valid-row control.
3. The wired standards guard rejects a new unpaired operations module and a removed companion, accepts a matching pair, and the full standards gate passes for the implementation diff.
