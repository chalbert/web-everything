---
bornAs: xasor4b
kind: story
size: 2
parent: "2612"
blockedBy: ["2859"]
status: open
dateOpened: "2026-08-02"
tags: [testing, gate, check-standards, vitest, tech-debt]
---

# A test whose title claims a refusal must assert the throw

A test named for a refusal — "refuses", "throws", "rejects", "fail closed" — must actually invoke the code under test in a way that can throw and assert it. Today a test can carry that title while asserting something adjacent and weaker, leaving the guard it names with zero coverage. This is script-decidable, so it belongs in `check:standards` rather than in a review lens: scan test titles for the refusal vocabulary and require a `.toThrow(` / `rejects.` assertion in the body.

## Where this came from

Filed out of the human review of **plateau-app PR #136** (the plateau-app half of #2832). That PR added a
fail-closed assert to `buildPassArgs` in `plateau-app:tools/drain-daemon/lib.mjs` and a test titled:

> `buildPassArgs refuses to build a pass that would disable the reconcile (fail closed)`

The body never calls `buildPassArgs` in a way that can throw. It appends `--no-reconcile-labels` to the array
`buildPassArgs` *returned* and asserts the pure predicate on the result:

```js
expect(childPassEnforcesHoldInvariant([...buildPassArgs({ owner: 'o' }), '--no-reconcile-labels'])).toBe(false);
```

So the new `throw` branch has no coverage at all. Delete or invert that `if`, and the whole suite stays green while
the fail-closed guarantee the PR advertises silently disappears.

## Why a gate and not a review note

The authoring failure mode is benign and therefore recurrent: a test gets written to *describe* the invariant
rather than to *exercise* the path that enforces it. A reviewer catches it only by reading the body against the
title, which is exactly the kind of mechanical cross-check a human reviewer skips and a script never does. The
signal is cheap and unambiguous — a title verb set on one side, an assertion form on the other.

## What to do

1. **Add the `check:standards` rule.** Over `**/*.test.mjs` / `**/*.test.ts`, for each `it(...)` / `test(...)`
   whose title matches the refusal vocabulary (`refuse`, `throw`, `reject`, `fail closed`, `must not build`,
   `unbuildable`), require the body to contain `.toThrow(`, `.toThrowError(`, or `rejects.`. Report title + file +
   line on failure.
2. **Tune for false positives before landing it.** Run the rule across both repos first and read every hit — a
   title like "refuses to include the flag" that legitimately asserts on a returned value is the case that decides
   whether the vocabulary needs narrowing or the rule needs an opt-out marker. Do not land a rule that forces
   authors to rename honest tests.
3. **Fix the originating case** — but note it depends on #2859 (a cross-repo argv guard must parse flags the
   way the receiving CLI parses them): the assert in `buildPassArgs` is
   currently unreachable for every input, so there is no argument that makes it throw. Validating the
   caller-supplied `label` there is what gives this test a real `toThrow` case. Sequence that item first.

## Acceptance

- `check:standards` fails on a test titled with the refusal vocabulary whose body has no throw/rejects assertion,
  and names the offending title, file, and line.
- The rule was run across the constellation before landing, and every pre-existing hit is either fixed or
  deliberately exempted with a stated reason — no blanket suppression.
- The plateau-app #136 case is green under the new rule: the fail-closed test asserts a real throw, and deleting
  the guard in `buildPassArgs` turns the suite red.
