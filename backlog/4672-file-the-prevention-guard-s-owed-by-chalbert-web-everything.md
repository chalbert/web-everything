---
bornAs: x2blmeh
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/backlog/scaffold.mjs", "we:scripts/backlog/__tests__/scaffold.test.mjs", "we:scripts/check-standards-rules.mjs", "we:scripts/__tests__/check-standards-rules-content-lint.test.mjs"]
dateOpened: "2026-09-30"
preparedDate: "2026-10-02"
preparedAgainstSha: "2c3fbe13ae553b425eda8d0ce7a21b25a8e412b6"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3154's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:backlog/4409-file-the-prevention-guard-s-owed-by-chalbert-web-everything.md:37` — Add a preservation test: `renderItem` output with no relaxing prose yields zero `findGuardRelaxationGaps`. Alternatively, reword the hint to avoid `refus*` and `loosen*` (e.g. "when a card weakens a check").
2. `we:backlog/4409-file-the-prevention-guard-s-owed-by-chalbert-web-everything.md:23` — Add a deterministic backlog lint rejecting `we:` scope references used as file arguments in executable acceptance commands.
3. `we:backlog/4409-file-the-prevention-guard-s-owed-by-chalbert-web-everything.md:31` — A unit test asserting that the exported hint line constant does not match the trigger regular expression.
4. `we:backlog/4409-file-the-prevention-guard-s-owed-by-chalbert-web-everything.md:32` — A semantic check ensuring every explicit 'does not trigger/satisfy' claim in the Design maps to a 'Preservation' test in the Test Plan.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3154@a2de8b56a4996490086695c812e19c3167c25031

## Done when

1. **Executable — Musts 1–3:** run `npx vitest run -t '#4672|#4409|#4431'` from the WE root. New #4672 capability cases fail against the preparation base and pass after implementation; the existing #4409 and #4431 cases remain green. Record matched test counts so an empty selection cannot count as proof.
2. **Musts 2–3:** `npm run check:standards` passes; demonstrate the new command error and negative-claim warning through the actual `lintBacklogItemRendering` entry point on synthetic open cards.

## Progress

Preparation research (2026-10-02), without stamping:

- **Old premise/scope:** four prevention debts were described through historical line references to `we:backlog/4409-file-the-prevention-guard-s-owed-by-chalbert-web-everything.md`, and scope contained only that card. Those references are review provenance, not current implementation locations.
- **Corrected premise:** debt 1 is already covered by the non-relaxing `renderItem` preservation case in `we:scripts/__tests__/check-standards-rules-content-lint.test.mjs:805`. Keep it; do not add a duplicate. `we:scripts/backlog/scaffold.mjs:16` still exports a hint containing both trigger stems; `we:scripts/check-standards-rules.mjs:969-980` avoids self-triggering by stripping the exact hint. Thus debt 3 remains: the raw wording contradicts the original nonmatching claim even though rendered output is protected.
- **Partial prior delivery:** `findNegativeClaimGaps` in `we:scripts/check-standards-rules.mjs:1050-1085` already checks negative claims, but recognizes only never/cannot/fail-closed phrasing and accepts identifier mentions anywhere in the Test plan. Its #4431 tests in `we:scripts/__tests__/check-standards-rules-content-lint.test.mjs:750` do not cover the requested does-not-trigger/satisfy wording or Preservation mapping. Extend that implementation rather than creating another semantic checker.
- **Observed evidence:** direct Node imports returned zero scaffold gaps, true for the raw hint matching both current trigger regexes, zero gaps for an uncovered Design claim that the hint “does not trigger,” and zero errors/warnings for an executable Vitest command with a prefixed file argument. These are concrete remaining gaps, not an already-delivered goal.
- **Corrected scope:** the two implementation modules and their existing matching test files replace the historical card-only scope. No changes to the resolved predecessor card are needed; its invalid acceptance command supplies a regression fixture. The original four debts remain accounted for, with debt 1 retained as existing coverage.

## Design

1. **Hint neutrality.** Reword `GUARD_RELAXATION_HINT` in `we:scripts/backlog/scaffold.mjs` to “Hint: when a card weakens a check, add two Must lines — error handling and all input kinds besides source code (docs, config, data).” Keep exact-line stripping as defense in depth. Export a pure sentence-trigger predicate from `we:scripts/check-standards-rules.mjs`, using the existing two regexes, and use it in the existing scanner and the raw-hint assertion. This pins the real production trigger without copying regexes into tests. Preserve the current trigger vocabulary and warning behavior.
2. **Executable arguments.** Add a pure detector in `we:scripts/check-standards-rules.mjs` and wire its findings into `lintBacklogItemRendering` errors for non-resolved cards. Scan only the `## Done when` acceptance commands: inline command spans attached to an Executable clause and shell/bash/sh fences in that section. Recognize file operands to `node`, `npx vitest run`, and `npx playwright test`, including quoted operands and `--flag=value` file arguments. Reject locus-prefixed file operands using the repository aliases/full names already recognized by the conventions. Report the operand and advise removing its locus for execution while retaining prefixed documentation references. Ordinary prose, scope metadata, URLs, package names, and quoted diagnostic text are outside this operand check. Do not execute commands or attempt a general shell interpreter; unsupported command forms are outside this first guard.
3. **Preservation mapping.** Extend the existing negative-claim helper in `we:scripts/check-standards-rules.mjs` for explicit “does not trigger”, “does not satisfy”, and “does not trigger/satisfy” claims, including hard-wrapped sentences. For this added class, require a single Preservation-classified Test-plan case containing the claim's extracted identifiers; a capability case or unrelated mention is insufficient. Reuse existing case grouping and token extraction. If the new explicit phrase has no extractable identifier, warn that the author must name the subject so the mapping can be checked. Apply this new class even when the Test plan is missing. Keep existing #4431 behavior for older negative phrases, and keep semantic findings warning-only on non-resolved cards. This is a deterministic textual coverage check, not proof that an assertion is semantically correct; human review still verifies the mapping.

## MVP

1. **Must 1:** neutral hint text, shared production trigger predicate, raw-hint nonmatch assertion, and retained scaffold preservation coverage.
2. **Must 2:** deterministic acceptance-command operand detector, error integration, and positive/negative fixtures covering the bounded command grammar.
3. **Must 3:** explicit trigger/satisfy claim coverage mapped to Preservation cases, with warning integration and missing-plan coverage.

Implementation/test pairs: `we:scripts/backlog/scaffold.mjs` → `we:scripts/backlog/__tests__/scaffold.test.mjs`; `we:scripts/check-standards-rules.mjs` → `we:scripts/__tests__/check-standards-rules-content-lint.test.mjs`. Keep integration assertions in the latter so the scaffold remains independent of the rules module.

## Test plan

All added case names include #4672.

- **Capability — raw hint:** the exported sentence predicate rejects `GUARD_RELAXATION_HINT`. Red on the base when asserted using the current production regexes: the hint matches both stems. Also assert the new wording in the scaffold test.
- **Preservation — scaffold:** retain the existing #4409 non-relaxing rendered-card case and relaxing-card two-gap case. Mutation: replace the emitted hint with an unstripped relaxing sentence; the first case fails. Mutation: let hints satisfy required phrases; the second fails.
- **Capability — command rejection:** each supported runner rejects prefixed operands in inline Executable clauses and shell fences, including quotes, flags, aliases, and full repository names. Assert the real lint returns errors for open cards. Red today: no detector or error exists.
- **Preservation — command boundaries:** valid local file operands, documentation references, package specifiers, URLs, quoted diagnostic messages, commands outside Done when, and resolved cards remain free of the new error. Mutation: broaden operand matching to all prefixed text or remove the status/section boundary; the corresponding case fails.
- **Capability — explicit claim mapping:** Design claims using all three trigger/satisfy forms warn with a missing plan, unrelated plan, capability-only case, or incomplete identifier coverage. Include multiple claims and hard wrapping. Red today: these phrases are unrecognized.
- **Capability — unkeyed claim:** explicit trigger/satisfy wording without an extractable subject warns with actionable guidance. Red today: unkeyed claims are skipped.
- **Preservation — covered claims:** a Preservation case naming all extracted identifiers clears its corresponding warning; two claims need their respective mapping. Mutation: disable matching or allow one unrelated case to cover every claim; the respective fixture fails.
- **Preservation — existing semantics:** fenced Design examples and resolved cards remain exempt; keep #4431 legacy negative-claim cases green. Mutation: scan fenced examples, remove the status guard, or change legacy coverage semantics; the corresponding case fails.

## Proof plan

Use direct imports of `renderItem`, the trigger predicate, `findTestPlanGaps`, and `lintBacklogItemRendering` to replay the preparation probes before/after. Save the probe inputs and outputs in implementation review evidence. Show the neutral scaffold remains gap-free, the raw hint becomes nonmatching, a prefixed test operand becomes an error, and an uncovered explicit negative claim becomes a warning that disappears only with the matching Preservation case. Keep invalid commands as inert fixture text; do not run them.

Run the selected tests in Done when, then both complete scoped test files (resolve the scope's repository prefixes into local paths before invoking a runner). Run `npm run check:standards` and inspect new findings across open cards. Record pre-existing failures separately; verify newly introduced command findings actually identify supported file operands, and semantic warnings identify missing mappings. Perform the named mutations independently, observe the targeted failure, and restore each mutation. Preparation itself changes only this card; implementation and its proof runs belong to the subsequent build.

## Follow-ups

- Additional command runners and compound shell grammar can extend the operand detector after fixtures establish their syntax.
- Broader natural-language entailment and audits of resolved cards remain outside this bounded guard. Do not promote semantic warnings to errors here.
