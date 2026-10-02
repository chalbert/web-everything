---
bornAs: xig4rre
kind: story
size: 2
status: resolved
scope: ["we:scripts/lib/soak-replay-gate.mjs", "we:scripts/lib/__tests__/soak-replay-gate.test.mjs", "we:scripts/lib/__tests__/fixtures/soak-replay-gate-real-prs.mjs"]
dateOpened: "2026-09-29"
dateResolved: "2026-10-02"
preparedDate: "2026-10-01"
preparedAgainstSha: "f22092f6af156c6905c4fb29a859656f77b08bed"
tags: []
---

# Soak-replay gate: don't read "not a bug fix" as a bug fix

Prevent explicit denials such as "This is a refactor, not a bug fix" from triggering the daemon bug-fix requirement when no independent positive signal remains. Preserve detection of actual fixes and the existing soak-scope, break-evidence, and waiver rules.

## Progress

Preparation research on 2026-10-01 confirmed the defect is still present; this is not already delivered.

- **Old premise/scope:** the card described three signals tested against the raw body, proposed skipping negated clauses (or a whole-body negation guard), and suggested linked-card `kind` values such as `bug` as a possible source of truth. It scoped the classifier, its unit suite, and the real-PR fixture file. It presented PR #2939 as directly replayable evidence of rejection and reported an approximately two-hour operator-approved hold.
- **Corrected premise:** `isLikelyDaemonBugFix` in `we:scripts/lib/soak-replay-gate.mjs` tests `FIX_TITLE_RE` against the **title**, and `FIX_HEADER_RE` / `FIX_WORD_RE` against the body. Its raw word branch still treats all four original denial examples as positive, observed by importing and calling the current function. Negation must suppress only the matched mention, never every signal in a body or clause. `BACKLOG_KINDS` in `we:scripts/check-standards-rules.mjs` contains story/epic/task/decision/feature/investigation; there is no `bug` kind, and `story` does not distinguish a fix from a refactor.
- **Live evidence:** read-only `gh pr view 2939 --repo chalbert/web-everything --json title,body,files` retrieved [PR #2939](https://github.com/chalbert/web-everything/pull/2939). Its current body has a later `soak-waiver:` line. Calling `evaluateSoakReplayGate` on that snapshot returns `{ applicable: true, ok: true }` through the waiver. Removing **only that entire waiver line** returns `{ applicable: true, ok: false }`; the remaining body contains exactly one `FIX_WORD_RE` token, "bug" in "not a bug fix", and neither title nor header matches. This is a derived replay of the reported failure, not a recovered original event payload. The read confirms the refactor claim and workaround, but does not independently establish the reported approval or two-hour duration.
- **Corrected scope:** keep the same three files. `we:scripts/lib/__tests__/soak-replay-gate.test.mjs` covers both the production classifier in `we:scripts/lib/soak-replay-gate.mjs` and fixture data in `we:scripts/lib/__tests__/fixtures/soak-replay-gate-real-prs.mjs`. The fixture file currently contains five PRs (#2762, #2763, #2765, #2768, #2771), not #2939. No schema, linked-card lookup, CLI, workflow, or daemon-scope edit is required. The existing integration consumer is `we:scripts/soak-replay-gate-cli.mjs`, with regression coverage in `we:scripts/__tests__/soak-replay-gate-cli.test.mjs`.

### Implementation proof — 2026-10-01

- Baseline source SHA: `bc2058219cef9235eb00e7a03ce4c2d20fd3bbaa`. Captured [PR #2939](https://github.com/chalbert/web-everything/pull/2939) read-only with title/body/files into `we:scripts/lib/__tests__/fixtures/soak-replay-gate-real-prs.mjs`, including its later waiver. The named derived replay removes exactly the one entire line beginning `soak-waiver:`. Tests reconstruct the original body by reinserting that line and assert unchanged title/files, no waiver, and no break file.
- **Before**, with new tests retained and original production source: affected suites reported `Test Files 1 failed | 1 passed (2); Tests 27 failed | 72 passed (99)`. Denial and replay assertions received `true` instead of `false`; CLI assertion received status `1` instead of `0`, `applicable: true` instead of `false`, and `ok: false` instead of `true`.
- **After**, the same suites reported `Test Files 2 passed (2); Tests 99 passed (99)`. Only the body-word branch masks bounded explicit denials with whitespace. Original title/header checks, scope, break evidence, waiver extraction, and five existing real-PR verdicts are unchanged. Tests cover all negators/articles/signal words, case, tabs, both apostrophes, repeated denials, mixed signals, and unsupported grammar/boundaries.
- Actual unchanged `we:scripts/soak-replay-gate-cli.mjs` child-process replay used an argument array with title, body, JSON files, and `--json` (no shell interpolation). **Before:** classifier `true`; gate `{applicable:true,ok:false}`; CLI exit `1`, JSON `{ok:false,applicable:true,waiver:null}` (reason: missing break evidence/waiver). **After:** classifier `false`; gate `{applicable:false,ok:true}`; CLI exit `0`, JSON `{ok:true,applicable:false,reason:"touches daemon-soak scope, but no fix-shaped title/body signal detected — treated as not a bug fix",waiver:null}`.
- Mixed replay with the same daemon-scope files and body “not a bug fix, but a regression was corrected” remains classifier `true`, gate `{applicable:true,ok:false}`, CLI exit `1` / JSON `{ok:false,applicable:true,waiver:null}`. Regression assertions prove adding break evidence or a non-empty waiver passes and out-of-scope files remain non-applicable.

- `npm run check:standards`: exit `0`, **0 errors**, 4594 warnings.
- Required `node we:scripts/verify-lane.mjs` selected the full unit suite and returned exit `2`: **8 failed / 838 passed / 1 skipped suites; 53 failed / 24884 passed / 35 skipped tests**. The gate remains red. It waited for shared full-suite capacity, then ran for 442 seconds. The standards half of that combined command did not run because the unit half failed; the separate standards command above passed.
- **Baseline isolation of the wider failures:** temporarily restored only `we:scripts/lib/soak-replay-gate.mjs` from the source SHA above, retained the new tests/fixture, replayed all eight failing suites, and restored the patch in `finally` without helper files. Original-source replay returned exit `1`: **the same eight suites failed, 53 failed / 257 passed tests**. These failures persist without this implementation. Observed errors include `spawnSync ps EPERM`, denied writes to the external user drain-lock directory, process-discovery assertions, and Gemini injected-process assertions. This does not establish a single cause for all failures.
- After restoring the patch, the affected suites again passed **99/99**. A redundant repeat standards run was interrupted while queued for shared capacity (exit `130`); the completed standalone standards result above remains the recorded proof.
- **Completion blocker:** implementation-specific proof is green, but the required lane gate is red on failures outside the declared scope. No unrelated source, tests, gate, or shared agent docs were changed. Leave the item open pending verification in a suitable environment and separate correction of any remaining baseline failures; the resolve operation has not been run.

## Design

Retain the three-way OR in `isLikelyDaemonBugFix`, with title/header checks unchanged. Replace only the raw body-word check with a pure, local mention filter: remove bounded, explicit negated word mentions from a scratch string, then apply the existing `FIX_WORD_RE` to what remains. Preserve the original body for header matching and waiver extraction. Do not return false merely because some denial exists, and do not discard a whole sentence or clause.

The minimum supported forms are case-insensitive `not`, `no`, `isn't`, `wasn't`, `is not`, and `was not`, followed by an optional `a`/`an` and one existing signal token. Accept straight and typographic apostrophes in contractions and horizontal whitespace between these words; do not bridge newlines, punctuation, intervening words, or word boundaries. This covers "not a bug fix", "no bug", "isn't a bug fix", "wasn't a regression", and "is not broken". Mask only the matched span, leaving every other token available to the existing heuristic. Replace spans with whitespace so surrounding words cannot be joined accidentally.

A denial followed by an affirmative bug mention, including on the same line, must still classify as a fix. "Not only a bug" and "not a minor bug" retain their positive signal because they are outside the bounded grammar. Ambiguous or unsupported language keeps the existing recall-favoring behavior. This is a narrow heuristic correction, not general natural-language classification.

No public signature or verdict shape changes: `isLikelyDaemonBugFix` remains synchronous and pure; `evaluateSoakReplayGate` continues to return its existing applicability, pass/fail, reason, and optional waiver fields. The already-selected negation MVP is sufficient; a linked-card taxonomy change is not required to deliver it.

## MVP

1. In `we:scripts/lib/soak-replay-gate.mjs`, implement the bounded mention filtering for the body-word branch and update its rationale/comments to describe the exception accurately. Keep title/header precedence, file scope, break handling, and waiver behavior intact.
2. In `we:scripts/lib/__tests__/fixtures/soak-replay-gate-real-prs.mjs`, freeze the fetched #2939 title/body/files with capture date and source URL. Preserve the fetched waiver in the snapshot; name and document the derived no-waiver replay in tests. Do not silently rewrite the stored snapshot as historical pre-waiver truth.
3. In `we:scripts/lib/__tests__/soak-replay-gate.test.mjs`, add denial and mixed-signal cases plus full-gate assertions using that replay. Keep existing real-PR expectations unchanged, including #2763's existing out-of-scope verdict.

## Test plan

All new assertions belong in `we:scripts/lib/__tests__/soak-replay-gate.test.mjs`; that suite also consumes and checks the changed fixture file.

- Table-test all six negation forms, optional articles, case, straight/curly apostrophes, and repeated denials. Denial-only bodies with a neutral title return false.
- Positive controls for every existing word (`bug`, `broke`, `broken`, `regression`, `incident`) remain true. Test an affirmative mention both before and after a denial, within one sentence and across lines. Include "not a bug fix, but a regression was corrected" and "no bug here; a bug elsewhere was fixed".
- Boundaries: "not only a bug", "not a minor bug", a negator on a preceding line, and negator-like substrings must not suppress a positive token. A fix-shaped title or recognized fix/root-cause/problem/incident heading remains positive despite a denial in the body. Missing fields continue to work.
- #2939's derived no-waiver replay must produce classifier false and `{ applicable: false, ok: true }`, with no waiver. Assert that the derivation removes exactly one waiver line and preserves title/files and every other body line. This prevents a passing test caused by stripping all bug-bearing prose or removing daemon-scope files.
- A synthetic in-scope positive bug fix without a waiver or break file remains `{ applicable: true, ok: false }`; adding break evidence or a non-empty waiver still passes. Out-of-scope changes still pass as non-applicable. Run all existing real-PR cases and waiver cases.
- Run the affected suite and the existing CLI suite `we:scripts/__tests__/soak-replay-gate-cli.test.mjs`; run `npm run check:standards` at implementation verification. No runtime implementation or new tests are part of this preparation-only edit.

## Proof plan

Use the same frozen #2939 snapshot and explicit no-waiver derivation before and after the implementation. Record the source SHA and the replay transformation. Before: classifier true, gate applicable and failing. After: classifier false, gate non-applicable and passing **without** a waiver or new break file. Replaying the current live PR with its workaround intact is not sufficient proof.

Drive the unchanged CLI `we:scripts/soak-replay-gate-cli.mjs` as a child process with an argument array containing the replay's title, body, JSON files, and `--json` (never interpolate PR text into shell code). Capture exit status and JSON: before exit 1 / applicable true; after exit 0 / applicable false. Also replay a mixed denial-plus-affirmation in daemon scope with no evidence: it must still exit 1. This exercises the actual gate entry point without writing to GitHub or mutating a live daemon.

Keep the new regression tests in place while comparing the original and patched classifier, then run the full affected suite. Attach the failing/passing assertion output and CLI verdicts to implementation evidence. The preparation probe above supplies observed baseline behavior only; no post-fix success is claimed yet.

## Follow-ups

- Unblock the wider verification separately: the original-source failures are in `we:scripts/lib/__tests__/gh-app-shim.test.mjs`, `we:scripts/__tests__/gemini-direct-task.test.mjs`, `we:scripts/operations/__tests__/host-process-sample.test.mjs`, `we:scripts/conveyor/__tests__/poc-branch-sync.test.mjs`, `we:scripts/lib/__tests__/daemon-jobs-runtime.test.mjs`, `we:scripts/operations/__tests__/restart-runner-io-real.test.mjs`, `we:scripts/operations/__tests__/clear-stuck-session-io-real.test.mjs`, and `we:scripts/operations/__tests__/heavy-queue-io-real.test.mjs`. Re-run the required lane gate where host process inspection and the existing test lock locations are permitted; investigate any remaining baseline failures in their own scope. Preserve all test and gate expectations.

- A structured bug-fix declaration may be investigated separately if needed. Existing linked-card `kind` cannot provide it; introducing a new kind, tag contract, or precedence rule requires its own researched proposal. No opportunistic taxonomy change in this size-2 slice.
- Sweep other conveyor prose classifiers for the same negation blind spot as separate work. Expand the bounded grammar only from concrete counterexamples with positive controls.

## Done when

The #2939 no-waiver regression and denial cases fail against the original classifier and pass after the change; independent positive signals and existing real-PR verdicts remain intact. The CLI replay meets the exit-status/applicability expectations above. The implementation runs the following executable check from the WE root (strip the repository prefix only when passing paths to the local runner):

```bash
suite=we:scripts/lib/__tests__/soak-replay-gate.test.mjs
cli_suite=we:scripts/__tests__/soak-replay-gate-cli.test.mjs
npx vitest run "${suite#we:}" "${cli_suite#we:}"
npm run check:standards
```
