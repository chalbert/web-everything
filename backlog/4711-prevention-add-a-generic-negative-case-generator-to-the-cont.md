---
bornAs: x34q6hg
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:contracts/plateau-progress-view.schema.json", "we:contracts/plateau-progress-view.examples.json", "we:contracts/plateau-progress-view.test.ts", "we:contracts/schema-negative-cases.ts", "we:contracts/schema-negative-cases.test.ts", "we:contracts/__tests__/schema-negative-cases*.test.ts"]
dateOpened: "2026-10-01"
preparedDate: "2026-10-02"
preparedAgainstSha: "413a940aba003331009bfe96c51ba9f283f67305"
tags: []
---

# Prevention — Add a generic negative-case generator to the contract test

Filed from the approval prevention findings on chalbert/web-everything#3330. Preserve the original goal: make schema rejection rules executable and resistant to accidental removal, including semantic constants, URL restrictions, and comparable delivery windows.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3330@40725023ccb98b76cb079e6121b1947186a8648f

## Progress

Preparation research, 2026-10-02:

- **Old premise/scope:** the mechanically filed card cited lines 22, 47 and 65 of we:contracts/plateau-progress-view.test.ts as missing negative coverage, requested a generator or coverage lint, HTTPS schema lint, isolated comparable-window tests, and a new PR lockfile gate. Scope listed only that test, we:contracts/plateau-progress-view.schema.json and we:package-lock.json.
- **Corrected premise:** the named contract files still exist, but the suite has grown. The comparable-baseline rejection remains at we:contracts/plateau-progress-view.test.ts:47; line 65 is now inside a fixture assertion, not a generator location. The health and provenance suites already walk selected fixture fields and assert targeted rejection, including provenance constants. They do not enumerate schema constraints. The current schema has 40 `const`, 29 `enum`, 92 `required` arrays and 174 `anyOf` occurrences; those counts are research evidence, not constants to freeze in tests.
- **URL evidence:** a recursive schema inspection found four URL declaration sites representing three data fields: action URL (base declaration and alternative), nested item PR URL, and PR-row URL. The action and item PR declarations accept arbitrary nonempty strings; the PR-row declaration already restricts GitHub HTTPS pull URLs. A read-only Ajv probe accepted `http://example.com` against both weak field schemas. Keep the HTTPS guard work; preserve the existing stricter PR-row constraint.
- **Window evidence:** a read-only Ajv probe compiled the current trend definition with its references, accepted an existing comparable fixture, and rejected each of eight separate changes: null count/start/end or false complete, in current and previous windows. The schema already supplies these constraints in `definitions.trend.allOf`; the existing baseline test changes status on a fixture with several missing facts and cannot prove each individual constraint matters.
- **CI evidence/scope correction:** we:.github/workflows/ci.yml:43 declares PRs against main without a path filter; its active test-shard job installs WE using `npm ci` at we:.github/workflows/ci.yml:124. The requested lockfile integrity mechanism exists. This is source inspection, not a claim of a successful live CI run. No lockfile or workflow edit is needed; the entire card is not already delivered because the generator and URL guards remain absent.
- **Corrected implementation scope:** add a test-support generator and its matching unit tests, extend the existing contract suite and examples, and tighten the two weak URL fields. The schema and examples are both covered by we:contracts/plateau-progress-view.test.ts; the new we:contracts/schema-negative-cases.ts is covered by we:contracts/schema-negative-cases.test.ts. Tests under this directory are already selected by we:vitest.config.ts:102. Preparation changes only this card; the runner owns stamping and checks.

## Design

Use the generator option already requested by the finding. Put pure, reusable test-support traversal and mutation logic in we:contracts/schema-negative-cases.ts; consume it from we:contracts/plateau-progress-view.test.ts. No runtime validator, dependency, or new CI job is needed.

Enumerate schema locations using escaped JSON Pointers, resolving local references while retaining both definition and instance locations. Traverse properties, array items, alternatives, conjunctions and conditional branches; guard reference cycles. Inventory each `const`, `enum`, each individual member of `required`, and each `anyOf`. Register deterministic named cases by schema pointer, keyword, instance pointer and witness name. Missing witnesses must fail coverage with actionable pointers, never silently skip a constraint. Keep witness mappings and small additional valid examples explicit; do not pretend arbitrary JSON Schema admits automatic valid-data synthesis.

For each case, first validate its positive witness. Clone it, change the constrained value or remove exactly the required property, and require rejection with the expected Ajv keyword and schema location. Use same-type values outside constants/enums where possible. For `anyOf`, construct a value that fails every alternative, with witnesses covering each satisfiable alternative. For an object alternative such as action URL versus fork reference, set both to null as one alternative-rule violation; changing only one valid alternative cannot prove rejection.

Separate conditional selectors from assertions: a `const` inside `if` selects a branch and is not itself a prohibition on other statuses. Test selector matching/nonmatching against the selector subschema and test the corresponding `then`/`else` behavior with contextual witnesses. Likewise, a constraint inside one union branch may fail while the full union legitimately accepts another branch. Label local branch tests explicitly and pair them with envelope/standalone-definition cases where rejection is part of the actual contract. Cover the standalone PR paging definitions as well as schema-1/schema-2 envelopes; they are not all reachable through snapshot examples.

Add a reusable URL-schema inspection to the same test-support module and exercise it over we:contracts/*.schema.json from the contract suite. Inspect `url` and names ending in `Url`, including nullable alternatives and local references. Every string-accepting alternative must carry an effective HTTPS restriction. Recognize the anchored HTTPS patterns used by this repository; reject unrecognized patterns with a pointer rather than claiming to prove arbitrary regex implication. Plain URI `format` does not constrain the scheme, and the current Ajv configuration does not enable an HTTPS-specific format. Keep null allowed where currently specified. Tighten action URL and item PR URL with an anchored HTTPS pattern; retain PR-row's GitHub-specific pattern and add one negative case per data field. This implements the HTTPS requirement already in the card, without adding hostname policy to the other fields.

Comparable-window cases use one fully valid comparable baseline. Parameterize both windows and each constraint: null count, false complete, null start, null end, negative count and malformed timestamps. The first four isolate conditional tightening; the latter values also exercise shared window constraints. Prove conditional sensitivity by removing the corresponding conditional field constraint in an in-memory schema copy and requiring the isolated witness to become valid. Do not demand that deleting one redundant constraint make a value valid if another still rejects it; name overlapping enforcement and test the relevant subschema separately.

## MVP

1. Implement schema inventory, reference-safe traversal, witness registration, deterministic mutation diagnostics and coverage accounting in we:contracts/schema-negative-cases.ts with focused tests in we:contracts/schema-negative-cases.test.ts.
2. Wire the inventory to we:contracts/plateau-progress-view.test.ts. Cover all current occurrences of the four keyword families, including every required member; add valid witnesses to we:contracts/plateau-progress-view.examples.json where the existing examples leave gaps. Preserve current health, provenance, paging and schema-1 compatibility regressions.
3. Add and unit-test the URL inspection, run it across the contract-schema glob from the existing contract suite, tighten the weak declarations in we:contracts/plateau-progress-view.schema.json, and add positive/null/negative field cases.
4. Add the isolated comparable-window matrix and in-memory constraint-removal sensitivity checks. Keep schema changes limited to the owed HTTPS restrictions; do not alter the already-correct window rules.

## Test plan

- we:contracts/schema-negative-cases.test.ts: nested objects/arrays, escaped pointer keys, shared and cyclic local references, individual required members, same-type const/enum violations, nullable unions, object alternatives, conditional selectors, missing witnesses and deterministic case IDs. Confirm fixture inputs and schemas remain unmodified.
- URL-lint unit fixtures: direct and referenced HTTPS patterns pass; nullable HTTPS passes; missing patterns, unanchored scheme checks, plain URI formats and an unrestricted union branch fail. Existing GitHub-specific HTTPS patterns pass.
- we:contracts/plateau-progress-view.test.ts: all existing examples remain valid; every inventoried constraint has named coverage; adding an uncovered synthetic constraint makes coverage fail. Each URL field rejects HTTP, protocol-relative, relative and javascript-scheme values while accepting its existing HTTPS fixture. Preserve action null URL with a valid fork reference, and reject both action targets null.
- Execute the comparable matrix for both windows. Demonstrate that each isolated conditional violation passes only after its corresponding tightening is removed from a cloned schema; shared nonnegative and timestamp constraints retain separate rejection cases.
- Implementation verification commands: run Vitest with we:contracts/schema-negative-cases.test.ts and we:contracts/plateau-progress-view.test.ts as repository-relative file arguments, then `npm run check:standards`. No rendered-page change is planned.

## Proof plan

Before implementation, preserve the read-only probe evidence above: non-HTTPS action/item URLs are accepted, whereas all eight isolated null/false comparable mutations are already rejected. This distinguishes the schema defect from the missing regression protection.

After implementation, capture the focused Vitest result and a generated inventory report showing schema pointers, case names and no uncovered constraints. Demonstrate red/green sensitivity with in-memory copies: weaken each URL guard and require its negative test or URL inspection to fail; remove each conditional window tightening and require the matching sensitivity assertion to detect the change; introduce an uncovered keyword occurrence and require the coverage assertion to fail. Restore the original inputs automatically by using clones, not worktree edits. Record the commands and outputs in this card at delivery. Passing existing tests alone is insufficient evidence for the new prevention.

## Done when

- The focused contract and helper suites pass with no uncovered supported constraint occurrence or required member, and deliberate missing-coverage mutations fail.
- URL inspection rejects the old unrestricted declarations; all three URL fields have named negative cases and preserve their valid/null behavior.
- Both comparable windows have isolated cases with demonstrated sensitivity to removal of their conditional constraints.
- Existing valid snapshots, standalone paging examples, and compatibility tests remain green; `npm run check:standards` passes. Existing PR `npm ci` remains the lockfile guard.

## Follow-ups

Expand the generic inventory to additional keyword families only with explicit mutation semantics and fixtures; the ellipsis in the original finding is not a claim of complete JSON Schema mutation support. Cross-field arithmetic, joins and temporal ordering retain their existing dedicated conformance checks. Broader adoption in other contract suites can reuse the helper; no runtime or cross-repository implementation is part of this item. No new lockfile gate is owed by the observed checkout.
