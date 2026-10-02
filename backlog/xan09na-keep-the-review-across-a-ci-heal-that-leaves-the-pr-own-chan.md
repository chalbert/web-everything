---
kind: story
size: 3
status: open
scope: ["we:scripts/conveyor/ci-heal-mark.mjs", "we:scripts/review-set-label.mjs", "we:scripts/conveyor/__tests__/ci-heal-mark.test.mjs", "we:scripts/__tests__/review-set-label.test.mjs"]
dateOpened: "2026-10-01"
preparedDate: "2026-10-01"
preparedAgainstSha: "a243696497bde756b580485d14caf77209650282"
tags: []
---

# Keep the review across a CI heal that leaves the PR own change unchanged (#4310 follow-up)

Keep an existing acceptance, including a previously granted human clearance, across a CI heal only when the PR's own contribution is mechanically proven unchanged. Any real contribution change still needs review. The originating operator ruling is recorded at we:backlog/4310-may-a-pr-keep-its-review-after-a-clean-mechanical-rebase-or.md:35-43; its shared-statute codification remains explicitly outstanding there at line 68. The existing carry safeguards are specified at we:docs/agent/platform-decisions.md:5381-5401, anchor `merge-only-push-approval-carry`; this item uses the existing digest route, not a new merge-replay policy.

## Progress

Preparation against the current checkout found the gap still present, but corrected the proposed mechanism and scope:

- **Old premise:** the CI-heal path should call an existing restamp proof named `decideRestampHumanClearance` before re-arming. **Observed:** we:scripts/conveyor/ci-heal-mark.mjs:204-224 reads labels and directly calls `spawnCiHealRearm`; there is no equivalence check. That helper already supplies `--only-if=accepted` at we:scripts/conveyor/ci-heal-mark.mjs:143-158. Keep this live-verdict protection.
- **Proof correction:** `decideRestampHumanClearance` checks only whether to attach carried human clearance (we:scripts/review-set-label.mjs:630-643). A null result does not refuse a plain restamp: the CLI continues to render its comment at we:scripts/review-set-label.mjs:1198-1209. The restamp label decision checks holds and an existing acceptance, not content equality (we:scripts/review-set-label.mjs:400-437). The actual reusable coverage predicate is `acceptanceCoversHead` at we:scripts/lib/review-escalation.mjs:2155-2218. Calling the existing restamp child alone is therefore insufficient proof for an agent-authored CI repair.
- **Head correction:** the existing wrapper passes `--new-head`, not the statute's expected-head guard (we:scripts/merge-ai-prs.mjs:774-795). The CLI trusts that override at we:scripts/review-set-label.mjs:1043-1049 and computes fingerprints through the branch reference at we:scripts/review-set-label.mjs:1189-1195. The new CI-heal path must bind proof and written markers to one full commit SHA and refuse a different live head; it must not copy those assumptions.
- **Existing adjacent work:** the recovery watcher already orders restamp before rearm (we:scripts/conveyor/ci-red-recovery-watch.mjs:470-485), but its positive test stubs restamp success (we:scripts/conveyor/__tests__/ci-red-recovery-watch.test.mjs:307-320). This is an ordering precedent, not evidence that changed CI repairs are rejected by the real child. Do not import the watcher into its own CI-heal dependency.
- **Scope correction:** replace the original rearm implementation/test scope with the shared label CLI and its tests, and add the missing CI-heal tests. The generic bounce-to-pending behavior remains the fallback; its accepted-only refusal already lives at we:scripts/review-set-label.mjs:343-354. Existing CI-heal spawn tests start at we:scripts/conveyor/__tests__/ci-heal-mark.test.mjs:75; a real-child test seam exists there at lines 161-178.
- **Incident qualification:** PR #3432 was the filed motivation; this preparation does not independently establish its round history or unchanged contribution. The recorded #3253 investigation instead demonstrates a changed contribution and explicitly distinguishes it from an unchanged-heal reproduction (we:backlog/4310-may-a-pr-keep-its-review-after-a-clean-mechanical-rebase-or.md:45-64). Use a reproducible fixture as the acceptance oracle, not either incident label.

## Design

1. Add a guarded CI-heal restamp path to the existing label CLI, selected by an explicit expected full head SHA (`--expect-head`, proposed implementation). On this path, read the live PR state, require an open PR with an existing acceptance and no human/changes hold, and require the live SHA to equal the expected SHA. Compute the scored net diff from that immutable commit in the PR's checkout. Compare the latest trusted reviewed SHA/diff/contribution markers using the existing coverage predicate; missing or unreadable evidence is not equality. This implements the head-binding and fail-closed requirements at we:docs/agent/platform-decisions.md:5386-5401 without widening the existing digest rules.
2. Enforce proof before any acceptance comment, ledger write, or label mutation. Recheck the live head and verdict before writing; a changed head or superseding verdict refuses the carry. The proof and all head-derived output markers must refer to the same expected commit. Use the existing human-clearance helper only after acceptance coverage passes; retain its latest-clearance binding and do not invent a new human clearance (we:scripts/review-set-label.mjs:607-643). A currently live human hold never clears through this route.
3. In the CI-heal marker hand-back, pass the healed commit and correct repo/cwd to that guarded restamp, with truthful CI-heal provenance. Resolve abbreviated heal heads to full commits before use, or refuse carry: the existing heal-head reader accepts prefixes (we:scripts/conveyor/ci-heal-mark.mjs:105-110). Do not assert the repair was content-preserving in free text before proving it. On successful restamp, never call rearm. On failed/unreadable proof or failed restamp, use the existing accepted-only rearm; its fresh state decides whether any acceptance remains to rearm. Non-accepted verdicts and human holds remain protected.
4. Preserve the durable heal comment and owed-write flow (we:scripts/conveyor/ci-heal-mark.mjs:182-203). Expose separate `restamped` and `rearmed` results so a successful heal marker cannot be mistaken for successful acceptance carry. Preserve the best-effort heal-reporting contract while recording a failed carry honestly; no direct GitHub label writes outside the shared boundary.

## MVP

Implement only the guarded CI-heal restamp branch, its CI-heal caller, and regression tests in the four scoped files. Reuse coverage parsing, hashing, comment/ledger machinery, and accepted-only rearm. Do not change normalization policy, general bounce handling, retry accounting, recovery-watcher dispatch, or merge eligibility. The review is carried, never rerun or newly granted by the healer. General migration of other restamp callers to the stronger head-bound contract is a follow-up, not an excuse to omit that protection from this new caller.

## Test plan

- Extend we:scripts/conveyor/__tests__/ci-heal-mark.test.mjs with a three-case replay: unchanged contribution after base movement restamps once and never rearms; changed contribution refuses carry and rearms; unreadable/missing proof refuses carry and takes the guarded fallback. Assert ordered calls, correct repo/cwd/full head, truthful result fields, and unchanged heal-comment/owed-write behavior. Extend the real-child seam at we:scripts/conveyor/__tests__/ci-heal-mark.test.mjs:161-178 so the test reaches the actual CLI instead of merely mocking successful restamp.
- Extend we:scripts/__tests__/review-set-label.test.mjs to exercise the guarded write boundary with trusted acceptance comments and real temporary Git histories. Cover plain acceptance and prior human clearance, missing markers, untrusted markers, unscored diff/git errors, missing/prefix/incorrect expected head, head movement and verdict replacement between reads, live human hold, and accepted-plus-changes. Assert no new acceptance record or clearance on refusal, and exact proven-head markers on success. The current hold checks to retain are at we:scripts/review-set-label.mjs:406-428.
- Parameterize changed contributions across source, tests, documentation, configuration and data, including a source rewrite with equivalent runtime value. None is exempt merely because CI becomes green. Use each head's own base, not a raw before-head/after-head diff, following the recorded diagnosis at we:backlog/4310-may-a-pr-keep-its-review-after-a-clean-mechanical-rebase-or.md:49-55.
- Run the two scoped suites plus existing we:scripts/conveyor/__tests__/rearm-review.test.mjs and we:scripts/conveyor/__tests__/ci-red-recovery-watch.test.mjs as regressions; then run the standards gate and lane verifier. No test implementation belongs in this preparation-only change.

## Proof plan

At implementation time, first add the real-child unchanged-heal regression and record it failing on the current direct-rearm behavior. Run `npx vitest run` with we:scripts/conveyor/__tests__/ci-heal-mark.test.mjs and we:scripts/__tests__/review-set-label.test.mjs as checkout-relative arguments, then retain the green replay output after implementation. Capture the temporary repository's reviewed head/base and healed head/base, trusted markers, command sequence, labels and emitted comments. Unchanged must show one carried acceptance bound to the healed SHA and no rearm; changed and unreadable cases must show no carry and the guarded fallback. Repeat with a live verdict/head change injected at the write boundary. Run `npm run check:standards` and `node` on we:scripts/verify-lane.mjs. This local replay exercises real code without modifying a live PR; production observation can follow through the normal delivery process.

## Done when

1. **Executable:** the new unchanged-heal real-child regression fails before implementation and passes after, alongside the changed/unreadable refusal cases in the two scoped test suites. Existing passing mocked-order tests alone do not satisfy this oracle.
2. **Must refuse on error:** unreadable proof, unscored diff, absent trusted markers, head mismatch or superseding verdict cannot mint a carried acceptance or human-clearance record. The fallback preserves the live-verdict and human-hold checks.
3. **Must cover every input kind:** source, tests, docs, config and data all participate in the same existing contribution proof; a real change in any of them still owes review, even if behavior seems equivalent or CI is green.
4. A proven unchanged heal retains its prior review without an additional rearm, and the durable output identifies the exact proven head and carry outcome.

## Follow-ups

- Codify #4310's reusable ruling in a separately authorized shared-doc task; the source card already records that gap at we:backlog/4310-may-a-pr-keep-its-review-after-a-clean-mechanical-rebase-or.md:68. Do not edit shared agent documents in this job.
- Audit other restamp callers against the expected-head statute: the current wrapper still supplies a trusted override (we:scripts/merge-ai-prs.mjs:774-795; we:scripts/review-set-label.mjs:1043-1049). This preparation records the implementation/statute drift rather than treating the weaker implementation as policy.
- Testing lesson: mock-only restamp ordering cannot prove content refusal. Keep a real-child replay and compare each contribution against its own base; record any sandbox limitations with actual failing probes rather than weakening the tests.
