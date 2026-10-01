---
bornAs: xtx1z8m
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/__tests__/open-pr-fetch.test.mjs"]
dateOpened: "2026-09-29"
preparedDate: "2026-10-01"
preparedAgainstSha: "bc2058219cef9235eb00e7a03ce4c2d20fd3bbaa"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2898's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. Add a Proxy-based contract test beside the static field assertion at `we:scripts/conveyor/__tests__/open-pr-fetch.test.mjs:65`. Pass wrapped REST-mapped PR objects into `normalizeOpenPrs`, record their property reads, and fail when a consumer reads a field the producer does not provide.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2898@57f200f0c4cc0ff2bead788f24ee003e7b342ef0

## Done when

1. The scoped test executes the real `normalizeOpenPrs` with guarded producer output, asserts nonempty normalized results, and records the observed top-level reads: `number`, `headRefName`, `labels`, and `files`.
2. Every observed read belongs to `BUILD_DISPATCH_PR_FIELDS` and is an own property of the supplied row. An absent property must throw with the property name, including when the caller would otherwise tolerate `undefined`.
3. A temporary extra consumer read of `pr.body` makes the new contract test fail. The same mutation passes the existing parity tests before the guard is added; removing it restores green. Record both outcomes rather than claiming the unmodified baseline should fail.
4. The focused suite passes with the guard and without the mutation. Retain existing REST mapping, fetch, and GraphQL parity coverage.

## Progress

- Original premise/scope: the approval owed a dynamic property-access guard at `we:scripts/conveyor/__tests__/open-pr-fetch.test.mjs:65`; the predicted touch-set was that test file alone.
- Verified premise/scope: the location still exists, but currently asserts a literal five-field constant rather than dynamically observing the consumer. The parity test at `we:scripts/conveyor/__tests__/open-pr-fetch.test.mjs:74` compares two normalized inputs and cannot detect a new optional read missing from both. The guard remains owed; retain the test-only scope. That scope already names the matching existing test, and no production source edit is needed.
- Source evidence: `we:scripts/conveyor/open-pr-fetch.mjs:47` supplies the five-field contract; `restPullToBuildDispatchShape` at `we:scripts/conveyor/open-pr-fetch.mjs:58` produces those fields. `normalizeOpenPrs` at `we:scripts/conveyor/build-dispatch-policy.mjs:136` reads four top-level properties. `isDraft` is supplied but unused, so observed reads must be a subset of the producer contract, not equal to all five fields.
- Preparation probe: executing the real normalizer with Proxy-wrapped GraphQL fixture rows from `we:scripts/conveyor/__tests__/fixtures/open-prs-rest-vs-graphql.json` produced two normalized rows and exactly the reads `files`, `headRefName`, `labels`, and `number`. The existing test file contains no Proxy guard. This probe verifies the premise; it is not the future regression test or mutation proof.

## Design

Add a local test helper in `we:scripts/conveyor/__tests__/open-pr-fetch.test.mjs` that wraps each PR row in a Proxy. Its `get` trap records the requested key, asserts membership in `BUILD_DISPATCH_PR_FIELDS`, asserts `Object.hasOwn(target, key)`, and returns `Reflect.get(target, key, receiver)`. Report the offending key on failure. Do not silently exempt unknown keys or provide fallback values.

Build rows using the existing paired fixture and the real `restPullToBuildDispatchShape(p, files)` export from `we:scripts/conveyor/open-pr-fetch.mjs`. Wrap each resulting row and pass it directly to the real `normalizeOpenPrs([{ repo: 'we', prs }])` export from `we:scripts/conveyor/build-dispatch-policy.mjs`; do not spread or serialize the Proxy before the call. Assert on the returned ordinary rows and the recorded reads, avoiding test-framework inspection of the Proxy itself.

Assert the sorted observed read set equals the four current consumer fields, while separately checking that the producer's own keys match `BUILD_DISPATCH_PR_FIELDS`. Keep the existing five-field pin, but rename its test description to describe the supplied contract accurately. Supplying unused `isDraft` is valid. This guard covers top-level PR fields; existing parity tests retain responsibility for nested label names and file paths. No exported interface, production behavior, persisted data, or migration changes.

## MVP

1. Add the local guarded-row helper and its negative control to `we:scripts/conveyor/__tests__/open-pr-fetch.test.mjs`.
2. Add the real mapper-to-normalizer contract test using the existing fixture, with nonempty output and explicit observed-read assertions. Keep mapped-output and normalization parity assertions.
3. Correct the static test's misleading description, run the focused suite, and perform the temporary consumer-read mutation described below.

Deliver as one test-only change. The existing size 3 covers the dynamic guard, negative controls, and mutation evidence; no shared helper extraction or production fetch change is required.

## Test plan

- Matching test for the read-only production dependencies `we:scripts/conveyor/open-pr-fetch.mjs` and `we:scripts/conveyor/build-dispatch-policy.mjs`: the already-scoped `we:scripts/conveyor/__tests__/open-pr-fetch.test.mjs`.
- Positive case: mapped fixture rows normalize successfully, retain expected values, and observe all four current fields. Assert producer keys independently so extending the constant without extending the mapper cannot bypass the guard.
- Negative controls: reading `body` through a guarded row throws with `body` in the diagnostic; removing `headRefName` from a fresh mapped row makes real normalization throw even though its current nullish fallback would otherwise hide the omission.
- Run the focused suite with the repository's admission wrapper:

```sh
node scripts/readiness/heavy-admission.mjs run -- vitest run scripts/conveyor/__tests__/open-pr-fetch.test.mjs
```

The command paths above are WE-relative: `we:scripts/readiness/heavy-admission.mjs` and `we:scripts/conveyor/__tests__/open-pr-fetch.test.mjs`. No network or live GitHub query is needed.

## Proof plan

In a disposable verification copy, temporarily insert `void pr.body;` inside the PR loop in `we:scripts/conveyor/build-dispatch-policy.mjs`. Run the focused suite first with the baseline tests and then with the new guard. Capture baseline success and a failure naming `body` from the new guard; this proves detection of a harmless-looking optional read absent from the producer contract. Remove the mutation and capture the full focused suite passing. The mutation is proof-only and must not enter the delivered diff or widen the implementation scope.

Run `npm run check:standards` for the completed build and inspect the final diff to confirm only the scoped test implementation changed. Preparation records the design and source probe only; the runner owns preparation stamping and checks, followed by independent review of the prepared card.

## Follow-ups

None required to fulfill the approval debt. A future intentional consumer-field addition must update the mapper, supplied-field contract, and observed-read expectation together. Nested-property instrumentation or guards for other consumers are separate work if a concrete gap is found; this item does not change their contracts.
