---
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:scripts/operations/review-extra-seats.mjs", "we:scripts/operations/__tests__/review-extra-seats.test.mjs", "we:scripts/operations/__tests__/review-extra-seats-provider-caps.test.mjs"]
dateOpened: "2026-10-02"
preparedDate: "2026-10-03"
preparedAgainstSha: "8a4b96161632caafcc5da32b896d16e3758787ec"
tags: []
---

# Prevention — Cover every resolveProviderCap consumer with the Gemini-default-off regression

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/operations/review-extra-seats.mjs:1260` — Add a test that iterates every consumer of resolveProviderCap with an empty env and asserts Gemini is never selected. Better still, compute the effective seat provider set in one shared helper that both paths call.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3497@dfe19f594719cb448fc8b294c58398de0eae727c

## Progress

Preparation research found a coverage gap, not evidence of a current default-cap bypass.

- **Old premise/scope:** the review cited line 1257 and requested that every consumer select no Gemini with an empty environment; scope named only the implementation and its extra-seat test suite.
- **Corrected premise/scope:** direct production callers are `reviewSeatCapUsage`, `runExtraSeats`, and `runRedTeam` in we:scripts/operations/review-extra-seats.mjs:207, we:scripts/operations/review-extra-seats.mjs:560, and we:scripts/operations/review-extra-seats.mjs:1260. The usage consumer reports caps; it does not select a provider. Both dispatch consumers already exclude providers whose usage reaches their cap. Cover reporting with a zero-cap assertion and dispatch with observable reservation/call assertions. Add the planned shared matrix at we:scripts/operations/__tests__/review-extra-seats-provider-caps.test.mjs, matching the source entry in scope alongside the existing suite.
- **Evidence:** we:scripts/operations/review-extra-seats.mjs:97 sets Gemini's default to zero; `resolveProviderCap` at we:scripts/operations/review-extra-seats.mjs:100 preserves explicit nonnegative integer overrides. Existing coverage at we:scripts/operations/__tests__/review-extra-seats.test.mjs:246 and we:scripts/operations/__tests__/review-extra-seats.test.mjs:502 checks the resolver and extra-seat dispatch. The red-team suite actually lives at we:scripts/operations/__tests__/review-red-team.test.mjs; its empty-env happy-path assertion at line 85 still permits Gemini, and its fallback assertion at line 146 permits Gemini too. No table covering all three consumers was found in the inspected suites. The prevention goal remains undelivered.

## Design

Add one table-driven consumer contract in we:scripts/operations/__tests__/review-extra-seats-provider-caps.test.mjs. Enumerate the three direct consumers with adapters for their distinct outputs: usage reporting, extra-seat dispatch, and post-accept red-team dispatch. Call the real exported functions with explicit `env: {}` (the usage function receives `{}` as its environment argument), fixed time, fresh records/ledgers, and fake I/O. Do not inherit operator environment or invoke provider CLIs, GitHub, or real reservations.

For each dispatcher, supply a valid pinned-head review payload and exercise both all-CLIs-available and only-Gemini-CLI-available cases. The first must actually launch allowed providers; the second must skip without reserving or launching Gemini. This prevents an empty call list or a preferred Codex route from making the regression pass vacuously. Usage reporting must retain the Gemini entry with cap zero and fraction null; reporting that entry is not provider selection.

Keep cap policy, routing policy, quota handling, reservation retries, and existing diagnostics unchanged. A shared production provider-set helper is unnecessary for this bounded prevention: executable consumer coverage directly addresses the owed guard without refactoring the two distinct dispatch loops. The implementation remains in scope as the coverage target; no runtime edit is expected.

## MVP

1. Add the named consumer table and isolated fake-I/O harness in we:scripts/operations/__tests__/review-extra-seats-provider-caps.test.mjs, adapting the fixture patterns from we:scripts/operations/__tests__/review-extra-seats.test.mjs and we:scripts/operations/__tests__/review-red-team.test.mjs.
2. Exercise all three consumers with an empty environment, including the dispatch fallback trap where Gemini is the only installed provider.
3. Add explicit positive-cap controls with only Gemini available, proving the harness reaches selection and the existing override remains supported. Retain the existing extra-seat diagnostic tests.

## Done when

- Must: every direct consumer is represented in the matrix; empty-env reporting yields Gemini cap zero, and neither dispatcher reserves or launches Gemini.
- Must: all-provider cases execute allowed seats, and Gemini-only empty-env cases skip without dispatch effects.
- Must: an explicit positive Gemini cap permits Gemini dispatch when it is the only available provider, with successful fake reservations.
- Executable: run the focused Vitest command in the Test plan. Prove regression sensitivity using the mutations in the Proof plan; the existing correct runtime need not fail merely because new tests are added.

## Test plan

Run `npx vitest run we:scripts/operations/__tests__/review-extra-seats-provider-caps.test.mjs we:scripts/operations/__tests__/review-extra-seats.test.mjs we:scripts/operations/__tests__/review-red-team.test.mjs`, stripping the documentation-only `we:` prefixes from command arguments when executing from the WE repository root.

The new matrix must assert reservation attempts, launched seat providers, and returned status for dispatch adapters; assert cap/fraction for the reporting adapter. Use fresh fakes per row and a valid accept payload with no prior red-team row so replay/deduplication cannot bypass selection. Include invalid and negative Gemini override cases for both dispatchers, which must retain the zero default, plus explicit zero and positive controls. Existing suites protect logging, cap accounting, quota holds, and reservation behavior.

## Proof plan

During implementation, record the focused suites' test counts and outcome. Temporarily change Gemini's default cap from zero to a positive value in we:scripts/operations/review-extra-seats.mjs and show the reporting and dispatch regression rows fail. Separately bypass the cap exclusion in each dispatch loop, one at a time, and show that its Gemini-only empty-env case detects a Gemini reservation or call. Restore each mutation before the final green run; never commit mutations.

Review a fresh search for `resolveProviderCap` production calls against the three-row inventory so a new consumer cannot be silently omitted during delivery review. Run `npm run check:standards` after the final change. These are implementation proof obligations; preparation does not claim they have passed, and the runner owns preparation checks and stamping.

## Follow-ups

No policy decision or prerequisite remains. Future production consumers must gain a corresponding matrix adapter. A shared eligibility helper can be considered separately if runtime divergence appears; this item does not change the operator's Gemini-default-off rule or the explicit opt-in contract.
