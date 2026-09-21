---
kind: story
size: 3
parent: "3029"
status: open
scaffoldedBy: "ratify-3056"
dateScaffolded: "2026-09-21"
relatedTo: ["3056"]
scope: ["we:scripts/lib/judge-spawn.mjs", "we:scripts/operations/cli-adapter.mjs", "we:scripts/lib/__tests__/judge-spawn.test.mjs"]
dateOpened: "2026-09-21"
tags: [plateau-loop, delivery, jury, judge, guard, argv]
---

# Refuse a leading-dash `model`/`mandate` at buildJudgeArgv, share one predicate with the adapter, and add a structural per-field test

Implement the ratified #3056 ruling: buildJudgeArgv refuses a model or mandate starting with "-", the adapter guard reuses the same predicate, and a structural test fails on any unguarded string option.

**The ruling being built** is statute
[we:docs/agent/platform-decisions.md#argv-builder-validates-caller-strings-at-its-own-seam](../docs/agent/platform-decisions.md#argv-builder-validates-caller-strings-at-its-own-seam)
(ratified in [#3056](/backlog/3056-the-judge-spawn-argv-guard-is-a-one-token-denylist-a-flag-sh/)). Read that anchor for the
rule and the rejected options; this card is only the build.

## What to change

1. **`buildJudgeArgv` refuses a leading-dash `model` and `mandate`** at its own validation seam in
   [we:scripts/lib/judge-spawn.mjs](../scripts/lib/judge-spawn.mjs) — the same place `effort`, `budget`,
   `sessionId`, `shape` and `allowedTools` are already checked. A value whose first character is `-` throws a
   `TypeError` that names the field.
2. **One predicate, shared.** `assertSafeJudgeRequest` in
   [we:scripts/operations/cli-adapter.mjs](../scripts/operations/cli-adapter.mjs) already refuses a `-`-leading
   `model`/`effort` one layer out, by its own inline rule (`value.trim().startsWith('-')`). Export one small
   predicate from [we:scripts/lib/judge-spawn.mjs](../scripts/lib/judge-spawn.mjs) and have both layers call it,
   so the two can never disagree on what counts as flag-shaped. The adapter trims first and the builder must not
   be weaker than it: a value like `" --x"` has to be refused by both, or by neither on purpose — pick one and
   pin it in a test.
3. **A structural test** that walks `buildJudgeArgv`'s options and fails when a caller-facing string option has no
   leading-dash guard, so a forgotten field is provably impossible rather than unlikely. Enumerate the options
   from the function's own destructured parameter list, not from a hand-kept list in the test.
4. **Leave the `--bare` denylist alone.** `FORBIDDEN_ARGV` / `assertNoForbiddenArgv` stay as the named trap
   record (#3028); their existing assertions must still pass unchanged.

## Done when

1. **Executable** — the new cases in [we:scripts/lib/__tests__/judge-spawn.test.mjs](../scripts/lib/__tests__/judge-spawn.test.mjs)
   fail on `main` and pass after: `model` and `mandate` each refused for `--dangerously-skip-permissions`,
   `--settings`, `--add-dir`, `-p` and `--tools`, with an injected `spawnFn` that is never called (no process
   started).
2. **Observable** — a `mandate` opening with a markdown bullet (`"- Do X"`) is refused with a message naming
   `mandate`; a normal alias (`sonnet`) and a normal mandate still build the same argv as today, byte for byte.
3. **Structural** — the per-field test in item 3 above exists, and adding a new unguarded string option to
   `buildJudgeArgv` makes it fail.
4. **Existing behaviour held** — the `--bare` refusal assertions and every current judge-spawn and cli-adapter
   test still pass; `npm run check:standards` is green.

## Known cost, accepted in the ruling

A `mandate` that legitimately opens with a bullet is now refused. Every mandate is a first-party string built by
a declaration (`review-pr`, `review-prep`), each opening with fixed prose, so the fix if one ever trips is a
one-line rewrite of that text — not a runtime path a caller has to route around. Do not add an escape hatch.
