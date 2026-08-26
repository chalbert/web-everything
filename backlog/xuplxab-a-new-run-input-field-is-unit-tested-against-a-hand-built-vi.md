---
bornAs: xuplxab
kind: story
size: 2
status: open
parent: "3029"
relatedTo: ["3035"]
dateOpened: "2026-08-26"
tags: [operations, epic-3029, prevention, testing]
scope:
  - we:scripts/check-standards.mjs
---

# A new run-input field is unit-tested against a hand-built view and never driven through `advance`

Flag a test that exercises an operation step by calling `step.effects(view)` / `step.fn(view)` on a
hand-written `view` literal, where no test in the same file drives that step through `advance` /
`projectReads` / `runOperationCli`. A step tested only against a literal is tested against a view the engine
cannot produce.

## The observation this is filed from

PR #1572 (#3035) added a `--reason` guard to `review-pr`'s `record` step, with four tests. Every one of them
built the view by hand:

```js
const viewFor = (answer, { findings = [], reason } = {}) => ({
  input: { pr: 7, repo: 'o/r', actor: 'operator', ...(reason === undefined ? {} : { reason }) },
  …
});
expect(() => recordOf().effects(viewFor(…))).toThrow(…);
```

`projectReads` never ran, so the tests asserted a path production never takes. The value they injected was
one the engine would have dropped — `record` did not declare `input.reason` — and the whole feature was dead
on every real run with the suite green. One reviewer's mutation probe was decisive: **deleting the entire
`--reason` plumbing from `we:scripts/operations/cli-adapter.mjs` reddened nothing** in `we:scripts/operations/__tests__/review-pr.test.mjs` or
`we:scripts/operations/__tests__/juror-flags.test.mjs`.

The same round's tests also built `verdict.verdict` with a stand-in (`findings.length ? 'changes' : 'accept'`)
rather than with the real `deriveVerdict`. That stand-in cannot produce the divergence the guard turned out to
have — a juror that ACCEPTS over a non-empty finding list — so a second hole stayed invisible for the same
reason. Both are the one shape: **the test constructs the value production derives.**

## The check

Over `scripts/**/__tests__/*.test.mjs`: find a call of the form `<step>.effects(<objectLiteral>)` /
`.fn(<objectLiteral>)` / `.request(<objectLiteral>)` whose argument is an object literal (or a local factory
returning one), and warn when the same file contains no call to `advance`, `advanceWhileRunning`,
`projectReads`, `driveRun` or `runOperationCli`.

A **warning**, not an error. A pure step function genuinely can be unit-tested against a literal, and for a
`compute` with no engine-shaped view that is the right test. What is being surfaced is a file where the
literal is the ONLY way the step is reached — which is the condition under which a projection bug is
invisible.

## Not in scope

Asserting that a specific field is covered. The check cannot know which input a change introduced; it can only
see whether the production boundary is exercised anywhere in the file. Narrowing it to "each new input field
needs its own `advance`-driven case" needs the diff and is a heavier item.

## Done when

1. **Executable** — a check that warns on `we:scripts/operations/__tests__/review-pr.test.mjs` at commit
   `a9f799fe`, whose `an override must say why` block calls `recordOf().effects(viewFor(…))` against a literal
   and whose only `advance` calls belong to unrelated blocks — and stops warning once a case in that block
   goes through `projectReads`.
2. **Mutation** — replacing the `projectReads`-built view in the post-fix tree with the old literal raises the
   warning again.
3. It names the file and the call site, and states in its own message that it checks the FILE, not the field —
   a check that claims coverage it does not have is worse than one whose limit is stated.
4. `npm run check:standards` — no new errors and no new warnings against the baseline at build time.

Owed as prevention by two independent correctness reviews of PR #1572 (#3035). Sibling of `x5df5nm`, which
gates the declaration side of the same defect; this one gates the test side, and either alone would have
caught it.
