---
kind: story
size: 2
status: open
scope: ["we:scripts/conveyor/reconcile-pass.mjs", "we:scripts/operations/pr-status.mjs", "we:scripts/operations/pr-status-io.mjs", "we:scripts/conveyor/__tests__/reconcile-pass.test.mjs", "we:scripts/conveyor/__tests__/reconcile-core.test.mjs", "we:scripts/operations/__tests__/pr-status.test.mjs", "we:scripts/operations/__tests__/promote-draft-pr-dispatch.test.mjs", "we:scripts/operations/__tests__/ci-heal-pr-dispatch.test.mjs"]
dateOpened: "2026-10-01"
preparedDate: "2026-10-01"
preparedAgainstSha: "79ca0f2dfe9cdaa3f64099506f1eee86ca581003"
tags: []
---

# A cancelled required check still strands a PR in awaiting-ci after #4187 was resolved

Preserve the goal: a draft with a cancelled required check must reach the existing CI recovery dispatch within one eligible tick, rather than repeatedly planning promotion and refusing it. The confirmed defect is incomplete planner input, not an absent cancellation classifier.

## Progress

Preparation, 2026-10-01: checked current code and performed read-only GitHub probes of PR #3336 at head `4ecb5deb362c81aa28de162db4616bb4c2009347`.

- **Old premise/scope:** two readers disagree because CANCELLED is not counted as failing; add a shared classifier in the reconcile core and test it there. The original incident report also attributed an hours-long loop and shadow health episodes to daemon logs. Those timing/log claims were not independently verified during preparation and are not acceptance evidence.
- **Corrected premise:** the readers already share `reduceCheckState` (we:scripts/conveyor/reconcile-core.mjs:1569; we:scripts/operations/promote-draft-pr-dispatch.mjs:84). Cancellation is already failing (we:scripts/operations/pr-status.mjs:137-139,194), and `ciFailed` imports that same conclusion vocabulary through its predicate (we:scripts/progress-board.mjs:511-521). Existing cancellation coverage is at we:scripts/operations/__tests__/pr-status.test.mjs:71-74 and we:scripts/conveyor/__tests__/reconcile-core.test.mjs:840-869. This is not evidence that #4187 regressed.
- **Observed reproduction:** `gh pr list` with the production-style open-PR query returned exactly 100 rollup rows for #3336, including repeated review-gate rows but omitting smoke, test and daemon-soak. Branch protection returned required names test, smoke, daemon-soak and soak-replay-gate. Feeding that list to the real reducer returned green with total=1; feeding the PR to `planReconcile` returned `promote-draft`. Paginated REST checks for the identical SHA returned all four required checks: smoke cancelled (job 110460009383), the other three successful. The same reducer returned red with failed=1/total=4. A separate `gh pr view` also exposed the cancelled smoke. These are preparation-time observations, not assumptions about every GitHub response or a permanent API limit.
- **Source explanation:** the shared snapshot is a raw `gh pr list` result with no check hydration (we:scripts/conveyor/open-pr-fetch.mjs:16-25); reconcile reads it before required-set enrichment (we:scripts/conveyor/reconcile-pass.mjs:1007-1024). The reducer filters to required names that are present but never verifies that every required name exists (we:scripts/operations/pr-status.mjs:171-177,188-205). Thus one present success masks missing required rows. Promotion uses that green verdict (we:scripts/conveyor/reconcile-core.mjs:1613-1619), whereas its fresh reader uses paginated REST (we:scripts/operations/pr-status-io.mjs:51-66) and refuses non-green (we:scripts/operations/promote-draft-pr-dispatch.mjs:143-155).
- **Corrected scope:** hydrate incomplete check input in the reconcile IO shell and prevent missing required names from producing green in the shared reducer. Include reducer, reconcile, promotion and heal-dispatch regression tests. No replacement classifier, review-status rewrite or new recovery mechanism. The awaiting-ci tag is draft-derived, not a CI classifier (we:scripts/conveyor/review-status-tag.mjs:148-154).

## Design

1. Reuse the existing reducer, conclusion vocabulary and per-name collapse. Keep numeric REST run IDs so latest-per-name selection remains independent of response order (we:scripts/lib/rollup-collapse.mjs:66-98). Duplicate review-gate entries are reproduction context, not proof of a classification bug.
2. In the reconcile IO shell, after obtaining the required set and before main-red enrichment, detect an absent required name or a rollup at the observed 100-row boundary. Read complete paginated check runs for that PR's exact head using the existing `checksArgv`/JSON-lines path (we:scripts/operations/pr-status-io.mjs:51-66). Inject the reader for tests; deduplicate reads by repo/head within the pass. Preserve the existing PR snapshot contract and other PR fields. Both standalone and shared-file input converge here (we:scripts/conveyor/reconcile-pass.mjs:1007,1080).
3. Preserve enrichment metadata: retain the REST ID, name, status, conclusion and completion timestamp when normalizing the hydrated rollup. `requiredCheckCompletedAt` feeds main-red attribution (we:scripts/conveyor/reconcile-pass.mjs:483-520); extending the REST projection must not erase that evidence. Complete the read before either phase classification or main-red attribution consumes it.
4. With an explicit nonempty required set, absent names must prevent a green verdict. Preserve existing pending/red precedence for observed runs; otherwise report unchecked with the missing names in the reason. A failed or malformed hydration must never fall back to promoting the known-incomplete snapshot: keep that PR non-actionable with a visible reason and continue processing unrelated PRs. Missing data alone must not invent a CI failure or launch a healer.
5. Once cancelled smoke is present, reuse the existing ci-red recovery branch (we:scripts/conveyor/reconcile-core.mjs:1632). Respect main-red attribution, live claims, stand-downs and heal caps. The one-tick promise applies when those existing guards permit dispatch; blocked cases must retain their explicit refusal. Do not weaken the fresh exact-head promotion check (we:scripts/operations/promote-draft-pr-dispatch.mjs:143-155).

## MVP

Implement the hydration and completeness guard above, plus regression cases using the observed #3336 input shape. Route recovery through existing CI-heal dispatch; do not add an unbounded rerun loop. Keep runtime changes within the declared scope. No status-label policy changes, health-watch activation or edits to shared agent documentation.

## Done when

- **Executable:** add tests named `xxh4zw8` and run `npx vitest run -t xxh4zw8`. Before the fix the truncated snapshot incorrectly promotes and the missing-required reducer case reads green; after it, hydration yields red and an eligible same-tick heal reaches the injected dispatch sink.
- **Must:** the planner and fresh promotion reader agree on complete same-head evidence; cancellation never grants promotion, and later success of the same named check can restore green.
- **Must on error:** failed/incomplete check reads refuse promotion with an observable reason; unknown is never treated as success or as sufficient evidence to heal.
- **Must for every change kind:** source, docs, configuration and data PRs obey the same required-check completeness rule; no diff-category exemption.

## Test plan

- In we:scripts/operations/__tests__/pr-status.test.mjs, cover one present success with missing required names, empty inputs, all required present, cancelled/failed/pending checks and unreadable conclusions. Preserve omitted-required-set fallback behavior and per-name rerun collapse.
- In we:scripts/conveyor/__tests__/reconcile-pass.test.mjs, replay a 100-row snapshot crowded by review-gate entries with cancelled smoke absent, then supply paginated REST rows with all four required names. Assert hydration occurs before enrichment and planning, keeps IDs/completion timestamps, and works through both ordinary readPrs and shared-file input. Cover repo/head targeting, one read per identical repo/head, required-name omissions below 100 rows, read errors, malformed data and unrelated PR progress.
- In we:scripts/conveyor/__tests__/reconcile-core.test.mjs, assert the hydrated draft plans ci-heal and never promote-draft; preserve existing capped and stood-down behavior. Include a superseded cancellation followed by success so an obsolete run cannot cause another heal.
- In we:scripts/operations/__tests__/promote-draft-pr-dispatch.test.mjs, feed the same complete head to the fresh reader and assert red/refusal with no ready call; preserve the read-error refusal. In we:scripts/operations/__tests__/ci-heal-pr-dispatch.test.mjs, connect the real replay plan to the injected dispatcher and assert one call carrying PR #3336 and its exact head, with an available lane and no existing claim. A plan row alone is not dispatch proof (we:scripts/operations/ci-heal-pr-dispatch.mjs:283-302).
- Run the full affected suites after the focused regression, then the standards and lane gates. This preparation changes only the card and does not add or run future implementation tests.

## Proof plan

1. Capture paired list-snapshot and paginated REST inputs for the same repo/head, the required set, reducer counts and planned action. Retain the #3336-shaped offline fixture so proof survives the live PR changing or closing. The preparation probe above establishes the current failure without issuing a rerun or promotion.
2. During implementation, run the fixture through real reconcile plus both injected dispatch boundaries: complete cancelled evidence must produce one eligible heal dispatch and zero promotion calls; unreadable evidence must produce no promotion. Record before/after commands and outputs, not only test names.
3. After deployment, observe one eligible mechanical tick on an affected PR and correlate its repo/head with the recovery claim/run. Record any cap, claim or resource refusal explicitly; do not claim production recovery from an offline passing test. Live writes are outside this card-only preparation.

## Follow-ups

- Audit other consumers of partial rollups separately; this scope fixes the reconcile path and shared reducer, not every GitHub reader.
- Keep the durable testing lesson here: cross-reader parity requires complete, same-head inputs and realistic pagination pressure. A single CANCELLED row was already tested and did not expose the incident (we:scripts/conveyor/__tests__/reconcile-core.test.mjs:840-869).
- Review check-fetch cost after live exercise; preserve the targeted hydration approach unless measured evidence warrants broader fetching. Record operational proof here before resolving the eventual implementation.
