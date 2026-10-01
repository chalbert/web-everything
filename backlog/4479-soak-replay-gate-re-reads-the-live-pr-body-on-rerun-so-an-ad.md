---
bornAs: xzbrscd
kind: story
size: 2
status: resolved
scope: ["we:.github/workflows/soak-replay-gate.yml", "we:scripts/lib/__tests__/soak-replay-gate-workflow.test.mjs"]
dateOpened: "2026-09-29"
dateResolved: "2026-10-01"
preparedDate: "2026-09-30"
preparedAgainstSha: "8d012f575a1bac47a9e1bd01d5b0fe3dac525209"
tags: []
---

# soak-replay-gate re-reads the live PR body on rerun, so an added soak-waiver takes effect

The gate must read the current PR body on every execution, including a rerun after a waiver is added or removed. Preserve its existing daemon-fix classification, waiver syntax, and merge-base file selection.

## Progress

- Implementation proof (2026-10-01, checkout HEAD `01bb3d9489728ce59e93e6d4639d6df0ca840b8f`): added we:scripts/lib/__tests__/soak-replay-gate-workflow.test.mjs, which parses and executes the actual workflow shell with temporary command substitutes and the real evaluator. Before changing the workflow, 15 of 16 tests failed: both CLI branches observed exits `[1, 1, 1]` with a fixed empty event body and `[0, 0, 0]` with a fixed event waiver, despite changing the API response. The script-absent bootstrap passed.
- After changing we:.github/workflows/soak-replay-gate.yml, both branches observe `[1, 0, 1]` as only the API body changes, with one authenticated API request per execution and constant title/base/head inputs. Exact captured arguments preserve modern SHA transport and legacy merge-base/file-status transport. Null/empty/whitespace-only waivers stay red; multiline quotes/backticks/dollar substitutions remain literal; retrieval failure emits a diagnostic and never invokes the evaluator or uses the stale event waiver. The bootstrap remains distinct and skips retrieval.
- Targeted verification: `npx vitest run` for we:scripts/lib/__tests__/soak-replay-gate-workflow.test.mjs, we:scripts/lib/__tests__/soak-replay-gate.test.mjs, and we:scripts/__tests__/soak-replay-gate-cli.test.mjs passed all 59 tests (16 workflow, 32 evaluator, 11 CLI).
- Final local verification: `npm run check:standards` passed with 0 errors (4589 warnings). Running `node we:scripts/verify-lane.mjs` from this checkout selected the workflow regression plus we:scripts/operations/__tests__/pr-status.test.mjs: 62 tests passed; its standards pass also had 0 errors, and the lane marker was recorded green. `git diff --check` passed. The requested resolve operation closes the local implementation handoff; the live evidence obligation below remains explicit.
- Live Actions proof and independent review remain outstanding: this job explicitly prohibits commits, pushes, and opening a PR, so the changed workflow cannot be published to an authorized disposable test PR here. No live edited-event/rerun result, run URL, or workflow provenance is claimed. The local shell replay is regression evidence, not completion of the live Proof plan; a human will review the diff and arrange that delivery evidence.
- Original premise/scope: the 2026-09-29 report says the worker for #4312 (PR #2939) added a waiver after a failed run, reran it, and remained blocked; PR #2938 reportedly cleared on rerun. The card proposed both a live body fetch and an `edited` trigger, scoped to we:.github/workflows/soak-replay-gate.yml and we:scripts/lib/soak-replay-gate.mjs. These incident reports have not been independently replayed during preparation.
- Corrected premise: we:.github/workflows/soak-replay-gate.yml:38 already includes `edited`. Its lines 62–65 bind title/body and base/head SHAs from the event; lines 82–86 pass that body to both CLI branches. The missing behavior is refreshing the body at execution time, not adding an event type. This supports the stale-input mechanism, without establishing why the two historical reports differed.
- Corrected scope: change the workflow transport and add its matching test, we:scripts/lib/__tests__/soak-replay-gate-workflow.test.mjs (planned). The pure evaluator in we:scripts/lib/soak-replay-gate.mjs already accepts a supplied body and recognizes non-empty waivers; no evaluator change is required. The omitted consumer, we:scripts/soak-replay-gate-cli.mjs, was inspected: its existing `--pr` branch fetches title, body, **and files** (lines 88–96), bypassing the merge-base branch (lines 113–116). Switching CI wholesale to that mode would change more than the body source.
- Preparation probe: invoking the real CLI twice with the same fix-shaped title and daemon-scope file list produced exit 1 with no waiver, then exit 0 with `soak-waiver: transport-only test fixture`. This isolates input freshness from waiver parsing. Existing parser coverage is in we:scripts/lib/__tests__/soak-replay-gate.test.mjs; CLI/diff coverage is in we:scripts/__tests__/soak-replay-gate-cli.test.mjs. The existing pure-gate suite passed all 32 tests during preparation. No live Actions rerun was performed.

## Design

Keep live-body retrieval in we:.github/workflows/soak-replay-gate.yml, the existing transport boundary. Grant `pull-requests: read` alongside `contents: read`. Supply `GH_TOKEN` from `github.token`, the repository from `github.repository`, and the PR number from `github.event.pull_request.number` as environment values. Fetch the PR via `gh api "repos/$PR_REPO/pulls/$PR_NUMBER" --jq '.body // ""'` on each execution, after the existing script-presence bootstrap guard and before invoking the CLI. Assign its output to `PR_BODY`; remove the event-body binding so there is one body source.

Treat API/authentication/parse failure as a failed check with an explicit retrieval diagnostic; never substitute the event body or report clear on retrieval failure. A successfully retrieved null body becomes an empty string. Keep body content as quoted argument data (`--body="$PR_BODY"`), never interpolate it into shell source or evaluate it. The existing CLI remains responsible for verdict exits: 0 clear, 1 unsatisfied gate, 3 usage error.

Retain the event title and base/head SHAs, full-ancestry fetch, main checkout, existing bootstrap behavior, and both merge-base/legacy invocation branches. Both branches must receive the fetched body. Retain all four current PR event types, including `edited`. Update the workflow's event-only/no-extra-permission commentary to describe the new transport. No new CLI flag, runtime module, schema, or migration is needed.

## MVP

1. Add the planned workflow test, executing the actual gate step with controlled command substitutes and PR environment data.
2. Wire the live body fetch, read permission, authentication, and explicit retrieval-failure handling in we:.github/workflows/soak-replay-gate.yml; update its comments.
3. Run the tests and standards checks, then obtain independent review of the implementation and live proof.

Size 2 remains appropriate: one workflow transport change and one focused regression test file. Deliver together in one PR. The workflow uses the existing CLI interface on main, so this needs no new CLI bootstrap or coordinated runtime rollout. Preparation review and stamping remain runner-owned.

## Test plan

The matching test for we:.github/workflows/soak-replay-gate.yml is the planned we:scripts/lib/__tests__/soak-replay-gate-workflow.test.mjs. Parse the workflow and execute its actual gate shell step in a temporary fixture, with fake `gh` and `git` commands and an argument-capturing `node` substitute. Feed the captured title/body and controlled daemon-fix file list to the real evaluator. Do not test a separately copied implementation of the shell step.

- Hold the event body, title, and SHAs constant; change the API response from no waiver to a valid waiver. Assert red then clear and a fresh API request on each invocation. Reverse the responses to prove removing a waiver returns red even if the event body still contains it.
- Exercise both existing CLI capability branches. Assert fetched body delivery and unchanged SHA/file-status arguments in each.
- Cover empty/null body, multiline markdown, quotes, backticks, dollar substitutions, and a whitespace-only waiver. Verify literal body arguments and no executed body content.
- Make the API command fail; assert a nonzero step result, retrieval diagnostic, and no evaluator invocation or stale-body fallback.
- Assert the workflow retains `edited`, main checkout, read permissions, and token/repository/PR-number bindings. Keep the pre-bootstrap script-absent case distinct from retrieval failure.

Run `npx vitest run` with we:scripts/lib/__tests__/soak-replay-gate-workflow.test.mjs, we:scripts/lib/__tests__/soak-replay-gate.test.mjs, and we:scripts/__tests__/soak-replay-gate-cli.test.mjs as repository-relative arguments, then `npm run check:standards`. These are implementation checks; the runner owns preparation checks.

## Proof plan

First demonstrate that the added workflow regression fails against the current event-body transport and passes after the change. A passing parser-only test is insufficient evidence.

After the updated workflow is available to a test PR, use an authorized disposable PR with a fix-shaped title, a daemon-scope change, and no soak-break change. Record its head SHA, initial no-waiver body, run ID/attempt, and failed gate verdict. Add a valid waiver without pushing a commit. Observe the `edited` run and explicitly rerun the earlier failed run; both must report the fetched waiver and clear at the same head SHA. Remove the waiver and repeat to demonstrate red again. Retain run URLs and verdict logs without tokens. Record which workflow revision each run executes; a rerun using the pre-fix workflow cannot prove the new transport. If Actions permissions or event delivery prevent a run, record that limitation and leave live proof outstanding.

## Done when

1. The workflow regression observes red → clear → red as only the API body changes; it fails against the old event-only transport.
2. Both CLI branches use the live body while retaining merge-base diff behavior, and retrieval failure cannot produce a clear result.
3. Targeted tests and standards checks pass, and the live edited-event/rerun proof is attached with unchanged head SHA and workflow provenance.

## Follow-ups

No additional implementation is required for this story. Investigate PR #2938 versus PR #2939 only if a discrepancy remains after recording their event/run provenance; their reported difference is not a reason to alter waiver policy. Broader title freshness, file-source changes, and check concurrency are outside this body's freshness fix. Independent review and live Actions evidence remain delivery obligations, not claims made by this preparation.
