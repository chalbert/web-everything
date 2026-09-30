---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/conveyor/fix-procedure.mjs", "we:scripts/conveyor/__tests__/fix-procedure.test.mjs"]
dateOpened: "2026-09-30"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3172's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/conveyor/fix-procedure.mjs:395` — Add a table-driven parity test over a list of repo- or HEAD-retargeting spellings. The test would assert that each one is refused when an implicit push follows it with a claim live. A new spelling then gets added to the table instead of being found in review.
2. `we:scripts/conveyor/fix-procedure.mjs:355` — Add `pushd`/`popd` and `env -C`/`--chdir` to the `CD_BEFORE` and `pushTargetUnreliable` spellings, with a table-driven test over every directory-changing spelling. Better: fail closed for any bare/implicit push in a multi-word command that contains a non-`git` directory-changing word.
3. `we:scripts/conveyor/fix-procedure.mjs:366` — Make the alternations disjoint (tokenise flags with a simple loop instead of a nested-quantifier regex) and add a test that `parseGitPushes` on 200 repeated flags finishes within a fixed time budget. A lint/gate for nested-quantifier regexes would catch the class.
4. `we:scripts/conveyor/fix-procedure.mjs` — Add a deterministic regression test asserting that echoed checkout text leaves a later unclaimed HEAD push allowed, paired with the existing actual-checkout refusal test.
5. `we:scripts/conveyor/fix-procedure.mjs:349` — A test case explicitly verifying that a command with a leading space (e.g., ` cd foo && git push`) triggers the unreliable/fail-closed behavior.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3172@dc3fc5d6998659fa65d92145eac501b666320076

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
