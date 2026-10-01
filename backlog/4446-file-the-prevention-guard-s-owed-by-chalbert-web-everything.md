---
bornAs: xtmhllw
kind: story
size: 3
parent: "4075"
status: active
scope: ["we:scripts/operations/cli-adapter.mjs", "we:scripts/operations/review-job.mjs", "we:scripts/operations/__tests__/review-pr.test.mjs", "we:scripts/operations/__tests__/judge-provider-selection.test.mjs", "we:scripts/operations/__tests__/judge-provider-port.test.mjs", "we:scripts/operations/__tests__/review-job.test.mjs"]
dateOpened: "2026-09-28"
dateStarted: "2026-10-01"
preparedDate: "2026-09-30"
preparedAgainstSha: "bc9db934c4b93158341ba01a74dccb71583765fc"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#2883's independent review

Filed mechanically ON APPROVAL (operator rule, 2026-09-27 — "prevention outstanding should be filed by default on approval") — this accept verdict named the guard(s) below as owed. None of them blocked the approval; the debt is tracked here instead:

1. `we:scripts/operations/cli-adapter.mjs:866` — Add a `reduce` test asserting that a `skipped` answer is reported as skipped or unrun (not 'accept') in the verdict output and the posted comment. Before the fix the run crashed, so this is still better than base.
2. `we:scripts/operations/review-job.mjs:197` — Match the last `error: ` line in stdout instead of requiring a prefix, and add a multi-line-stdout test.
3. `we:scripts/operations/cli-adapter.mjs:866` — Key the cwd-withholding rule on the seat (a tool-free / `gracefulOnUnavailable` flag), not on the provider name. Add a test that asserts a fallback request never carries `cwd`.
4. `we:scripts/operations/__tests__/review-pr.test.mjs:2871` — Add a table-driven test over all judge steps that asserts `gracefulOnUnavailable` is true only for the advisory steps. A check:standards rule could also flag the flag appearing in a mandatory-seat request builder.
5. `we:scripts/operations/cli-adapter.mjs:681` — Enforce a branch-coverage floor on new/modified lines (e.g., via Vitest coverage thresholds for changed files) to mechanically flag the untested `catch` block.
6. `we:scripts/operations/cli-adapter.mjs:864` — An AST-based code duplication linter (like jscpd or an ESLint equivalent) integrated into check:standards to flag identically duplicated expressions.
7. `we:scripts/operations/review-job.mjs:180` — Use `.includes('error: ')` or `.match(/(?:^|\\n)error: /)` to locate the deliberate crash message anywhere within `stdout`, rather than enforcing a strict prefix check.
8. `we:scripts/operations/cli-adapter.mjs:101` — Strip `cwd` based on capability instead of a hardcoded string: `cwd && !TOOL_FREE_JUDGE_PROVIDER_NAMES.includes(effectiveProviderName)`.
9. `we:scripts/operations/cli-adapter.mjs:710` — A unit test asserting that all tool-free fallback providers (like `antigravity`) do not receive a `cwd` argument, preventing untrusted file loading.
10. `we:scripts/operations/review-job.mjs:199` — A unit test for `crashLabelFromLoop` passing a multi-line `stdout` string with `error: ` appearing after other text, ensuring it still extracts the error.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#2883@4666052696cac39fb6a1616bec856d5a78ee65b8

## Done when

1. **Executable** — `npx vitest run we:scripts/operations/__tests__/judge-provider-selection.test.mjs we:scripts/operations/__tests__/judge-provider-port.test.mjs we:scripts/operations/__tests__/review-job.test.mjs we:scripts/operations/__tests__/review-pr.test.mjs` fails before this item lands (the antigravity-cwd and multi-line-stdout cases are RED; the skipped-reduce and table-driven cases are characterization tests that pin current behaviour and guard regression) and passes after.

## Progress

- 2026-09-30 prepare pass. Premise check: no commit on `main` delivers these guards (`git log` for `4446`/`xtmhllw` shows only the JIT-numbering commit). Citations drifted: the card's line numbers are stale (`we:scripts/operations/cli-adapter.mjs:866/101/710/681/864` now sit at 715 / 862-865 / 823 / 880 / 862; `we:scripts/operations/review-job.mjs:197/199/180` now at 198). Scope drift corrected: `scope:` named `we:scripts/operations/__tests__/cli-adapter.test.mjs`, which does not exist; the `createDefaultJudge` tests live in `we:scripts/operations/__tests__/judge-provider-selection.test.mjs` (cwd/model withholding, ~L384) and `we:scripts/operations/__tests__/judge-provider-port.test.mjs` (graceful path, ~L138). Scope now names those two. Goal unchanged.
- Already delivered: guard 5 (branch-coverage floor on changed lines) — `we:scripts/lib/diff-branch-coverage.mjs` (`DIFF_BRANCH_COVERAGE_FLOOR = 80`, #2876). Nothing to build; recorded under Design.
- Duplicates: guards 2 + 7 + 10 are one fix (crash-label matching) with one test; guards 3 + 8 + 9 are one fix (cwd keyed on seat) with one test.

- 2026-10-01 build. A (crash label: last line-anchored `error: `) and B (cwd keyed on `TOOL_FREE_JUDGE_PROVIDER_NAMES`) done, with tests. C: the characterization test was RED — the skip showed only in the verdict `summary`, not the posted write-up (the advisory row read `accept`). Minimal fix: `reduce` records `skippedSeats` on the verdict and `renderVerdictWriteUp` prints a "Skipped seats" line. D: table test added (graceful ⇒ advisory; mandatory seats falsy). Mutation proof for D not run.

## Design

**A. Crash label (guards 2, 7, 10).** `crashLabelFromLoop` (`we:scripts/operations/review-job.mjs:196-199`) only accepts stdout when it *starts with* `error: `. `we:scripts/operations/review-loop-cli.mjs` writes its crash as `error: <msg>` to stdout, but anything printed earlier on stdout (progress lines) pushes it off the first position, so the label falls back to stderr noise (the exact punycode-warning defect it was written to fix). Change: split stdout into lines and take the **last** line matching `/^error: /` (last, because a later line is the real crash; an earlier one may be an echoed sub-error); return that line. Keep the stderr-then-stdout fallback unchanged when no such line exists. Rejected: `.includes('error: ')` (guard 7's first suggestion) — it matches mid-line text such as `... stderr said error: x`; the line-anchored form is the stricter reading of the same guard.

**B. cwd withholding keyed on seat (guards 3, 8, 9).** `buildProviderRequest` (`we:scripts/operations/cli-adapter.mjs:715`) drops `cwd` only when `effectiveProviderName !== 'codex'` is false. `antigravity` is tool-free too (`TOOL_FREE_JUDGE_PROVIDER_NAMES`, L647) yet still receives `cwd`, and `we:scripts/lib/antigravity-judge-spawn.mjs:648` then uses it as the process cwd — so the graceful fallback codex→antigravity (L850-859, `buildProviderRequest(effective, cwd, spawnProviderName)`) can hand the untrusted PR checkout to a tool-free seat, the very leak L713-714's comment says codex must never have. Change: `cwd && !TOOL_FREE_JUDGE_PROVIDER_NAMES.includes(effectiveProviderName)`. This keys on the existing tool-free capability list (the same list the model-merge guard at L815 and the tool-bearing refusal at L824 already use) rather than a name literal. Guard 3's alternative ("a `gracefulOnUnavailable` flag") is rejected: that flag means "advisory/skippable", a different property from "tool-free", and conflating them would couple two independent concerns.

**C. Skipped is not accept (guard 1).** A graceful skip returns `{summary: 'skipped: <reason>', findings: [], skipped: {...}}` (`we:scripts/operations/cli-adapter.mjs:862-866`). `reduce` (`we:scripts/operations/review-pr.mjs:~2354-2364`) never reads `skipped`; it only needs a non-empty summary, so the skip surfaces solely as the text `"<lens>: skipped: …"` inside the joined verdict `summary` (L2435), and the lens still counts in `lenses`. The guard asks for a test pinning the reported behaviour, not a behaviour change: add a `reduce` test where one advisory seat answers with a `skipped` value and assert (1) the verdict is still derived from the other seats, (2) the output `summary` contains `skipped:` and the reason for that seat, (3) the rendered/posted comment (same path existing reduce tests use to assert the comment) carries it. If the test shows the skip is NOT visible in the posted comment, the builder fixes `reduce`/render minimally to surface it and records that in Progress — do not escalate.

**D. Graceful flag only on advisory seats (guard 4).** Requests are built per seat in `we:scripts/operations/review-pr.mjs` (`buildReviewJudgeRequest` L1195 for the mandatory seats, `buildReviewAdvisoryJudgeRequest` L1273 and `buildReviewCorrectnessAdvisoryJudgeRequest` L1375 plus the antigravity seat ~L1466 for advisory). The authoritative advisory list is `ADVISORY_SEAT_STEPS` (L533). Two single-seat assertions exist (`we:scripts/operations/__tests__/review-pr.test.mjs:2873,3121`); add one table-driven test over every seat step reachable at confirm time asserting ONE direction only (the guard says "true only for advisory"): `gracefulOnUnavailable` truthy IMPLIES the step is in `ADVISORY_SEAT_STEPS`, and it is falsy for every `JUDGE_STEPS` seat. NOT "iff": the antigravity advisory seat (`buildReviewAntigravityJudgeRequest`, `we:scripts/operations/review-pr.mjs`~L1477) deliberately does not set the flag today, and adding it is a behaviour change (see Follow-ups). The optional `check:standards` rule is deferred (Follow-ups).

**E. Guard 5** — already delivered (see Progress); no work.
**F. Guard 6** (AST duplication linter) — a new gate tool/dependency decision; out of this item's scope (Follow-ups).

## MVP

Musts: A, B, C, D as above, each with its test; the stale `scope:`/citation corrections in this card. Deliberately OUT: guard 5 (already delivered), guard 6 (new linter), the `check:standards` flag-in-mandatory-builder rule from guard 4, and any behaviour change to how `reduce` weights a skipped seat.

## Test plan

1. `we:scripts/operations/__tests__/review-job.test.mjs` — `crashLabelFromLoop({stdout: 'progress line\nmore\nerror: boom', stderr: '(node) [DEP0040] DeprecationWarning...'})` returns `'error: boom'`. RED before: `startsWith` fails, returns the stderr noise. Also: two `error:` lines → the last wins; a mid-line `x error: y` is NOT matched (falls back as today).
2. `we:scripts/operations/__tests__/judge-provider-selection.test.mjs` — `createDefaultJudge({cwd:'/some/lane'})` with a request pinned to `antigravity` → spawn call has `cwd` undefined (mirror the codex case at ~L385). RED before: `cwd` is `/some/lane`. Plus a graceful-fallback case in `we:scripts/operations/__tests__/judge-provider-port.test.mjs`: codex quota-held, antigravity usable, factory `cwd` set → the antigravity request carries no `cwd`. RED before for the same reason. Keep the existing "claude still receives cwd" case green (proves the guard is not over-broad).
3. `we:scripts/operations/__tests__/review-pr.test.mjs` — reduce with an advisory seat answering `{summary:'skipped: codex quota exhausted', findings:[], skipped:{provider:'codex',reason:'quota exhausted'}}` plus clean mandatory seats: verdict is `accept`, and verdict summary / posted comment text includes the `skipped` reason. This is a characterization test: it is GREEN if the skip is already visible (then it guards regression) and RED, driving the minimal render fix, if not — the builder states which in Progress.
4. `we:scripts/operations/__tests__/review-pr.test.mjs` — table over every seat step: `gracefulOnUnavailable` true exactly for `ADVISORY_SEAT_STEPS`, falsy for `JUDGE_STEPS`. RED check: temporarily set the flag on a mandatory builder and confirm the case fails (mutation proof, noted in Progress).

## Proof plan

- Before/after on the real function: run the new tests on `main` (RED: crash-label, antigravity cwd) and on the branch (GREEN), pasting the vitest output.
- Live probe for A: `node -e` calling `crashLabelFromLoop` with a real `we:scripts/operations/review-loop-cli.mjs` crash captured stdout/stderr (e.g. run it with a bad argument) before/after.
- Live probe for B: a one-off script calling `createDefaultJudge({cwd:'/x', resolveProvider})` with `providerName:'antigravity'` and printing the received request keys before/after.
- Mutation proof for D (above), and `npm run check:standards` green.

## Follow-ups
- Antigravity advisory seat does not set `gracefulOnUnavailable` (`buildReviewAntigravityJudgeRequest`), so a quota hold there can still crash the run unlike the two Codex seats; decide whether to opt it in (behaviour change) as its own item.

- Guard 6: evaluate an AST duplication linter (jscpd or ESLint equivalent) in `check:standards` — needs a tooling/dependency decision; file as its own item.
- Guard 4 (optional half): `check:standards` rule flagging `gracefulOnUnavailable` in a mandatory-seat request builder.
- Guard 5 follow-up only if the per-diff floor proves not to cover `catch` blocks in `we:scripts/operations/cli-adapter.mjs` — not owed now.
