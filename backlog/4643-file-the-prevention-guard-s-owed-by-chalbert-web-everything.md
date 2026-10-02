---
bornAs: x3etl9g
kind: story
size: 3
parent: "4075"
status: open
scope: ["we:skills-src/conveyor/fix-agent-brief.md", "we:scripts/operations/__tests__/dispatch-lane.test.mjs", "we:scripts/conveyor/__tests__/verify-dispatch.test.mjs", "we:scripts/__tests__/pr-land-finish-guard.test.mjs"]
dateOpened: "2026-09-30"
preparedDate: "2026-10-02"
preparedAgainstSha: "70a302401313c4ac57bd86b12e9cd44aea1a32ab"
tags: []
---

# File the prevention guard(s) owed by chalbert/web-everything#3144's independent review

Filed mechanically ON APPROVAL of chalbert/web-everything#3144. The independent review owed three prevention guards: bounded retry instructions, verification through the fix-lane commit/finish boundary, and sibling-repository runner discovery. This item adds the missing regression coverage and live-proof requirement; it does not redesign gate policy.

Current implementation loci:

1. Step 4 of `we:skills-src/conveyor/fix-agent-brief.md:345` requests verification and waits for its verdict. Its timeout branch already caps consecutive waits at 18 and requires reporting the stalled request. Guard that existing bound and terminal outcome rather than introducing another retry policy.
2. Repo-aware rendered-brief tests in `we:scripts/operations/__tests__/dispatch-lane.test.mjs:2757` check request/check commands, but the negative assertions at lines 2780 and 2794 depend on exact spaces and a trailing comment. Check executable step-4 commands independently of whitespace; the prose legitimately mentions the forbidden synchronous command.
3. `we:scripts/conveyor/__tests__/verify-dispatch.test.mjs:84` covers real request/dispatch/check with explicit trivial gates in a synthetic pool. Extend it to cover sibling-repo discovery and default gate selection together. `we:scripts/__tests__/pr-land-finish-guard.test.mjs:46` exercises the real finish guard with hand-written markers; extend it with a marker produced through the request/runner path.

Idempotency key (do not edit): approval-prevention-key:chalbert/web-everything#3144@943b15503c87acc0ec3b7589e055f6d1d4b1cc87

## Design

Keep the existing asynchronous protocol and its 18-timeout bound. In `we:scripts/operations/__tests__/dispatch-lane.test.mjs`, extract step 4 from the real rendered fix brief for WE and plateau-app. Assert that each retry instruction for a still-running request names a numeric cap and a terminal stop/report outcome. Pin the current cap, bounded foreground wait, and prohibition on automatic reset/re-request. Here “stand-down outcome” means the existing stop-and-report instruction, not a new terminal judgment classification or a new reason for the stand-down CLI.

Scan executable command blocks in step 4 for the whitespace-tolerant pattern `/verify-lane\.mjs\s+run\b/`; do not reject explanatory prose that warns against that command. Apply the same command-only check to the existing ci-heal assertion in `we:scripts/operations/__tests__/dispatch-lane.test.mjs`. Add mutation cases that remove the cap, remove the terminal outcome, or insert a synchronous command with varied spacing, so a passing assertion cannot be vacuous.

Use the existing temporary Git pool fixtures in `we:scripts/conveyor/__tests__/verify-dispatch.test.mjs`. Add a plateau-app-shaped checkout with a test-only npm script and no WE-specific scripts, request without a gate override from that lane's cwd using the WE CLI, run the real discovery sweep with an isolated pool root, and read the verdict through check. The local test script records its cwd and returns a controlled success or failure. Assert the selected suites, discovered pool/lane, executed cwd, and terminal verdict. Do not stub the dispatcher or write a terminal marker by hand.

In `we:scripts/__tests__/pr-land-finish-guard.test.mjs`, drive a fix-branch fixture through request, runner settlement, committing the verified edits, and `resolveFinishGuardVerdict` exported by `we:scripts/pr-land.mjs:638`. Include a commit before settlement and a changed-after-verification control. Assert the existing guard's refusal of stale/unverified evidence and successful delivery only once verification covers the committed head. This is coverage of current authorization semantics, not permission to carry any old green across a commit.

Add a short requirement to step 4 of `we:skills-src/conveyor/fix-agent-brief.md`: changes to asynchronous gate instructions need recorded live proof in a disposable WE lane followed by a sibling lane before landing. Its matching test is `we:scripts/operations/__tests__/dispatch-lane.test.mjs`.

## MVP

- Add the bounded-retry and executable-command brief checks, including mutation controls, to `we:scripts/operations/__tests__/dispatch-lane.test.mjs`.
- Add the sibling default-gate round trip, both green and red, to `we:scripts/conveyor/__tests__/verify-dispatch.test.mjs`.
- Add the real-marker request/commit/finish-guard sequence and stale-evidence controls to `we:scripts/__tests__/pr-land-finish-guard.test.mjs`.
- Add the live-proof requirement to `we:skills-src/conveyor/fix-agent-brief.md` and collect that proof during implementation. No production runner, gate, or landing-policy changes are predicted.

## Test plan

Run targeted Vitest against `we:scripts/operations/__tests__/dispatch-lane.test.mjs`, `we:scripts/conveyor/__tests__/verify-dispatch.test.mjs`, and `we:scripts/__tests__/pr-land-finish-guard.test.mjs`. They are already covered by the tooling-test include in `we:vitest.config.ts:106`; keep the new cases in those files so the ordinary test gate executes them without an opt-in flag.

Use temporary repositories, local identities, an isolated pool, bounded process waits, and cleanup in teardown. No network, PR mutation, or shared live lane is needed for deterministic tests. Ensure the sibling fixture has a valid base/diff so default selection does not fail for an unrelated missing-base reason. Prove failure propagation as well as success; a skipped gate must not satisfy the test. Exercise the brief checker against deliberately broken text and show those mutations fail. Run the standards gate during implementation and retain its output.

## Proof plan

Before landing an implementation, record the rendered step-4 commands and execute them in a disposable WE fix lane, then a sibling-repo lane. Capture request acknowledgement, runner discovery, selected gate, check verdict/exit code, and head identity. For the fix sequence, capture the finish-guard result before settlement, after a commit invalidates the earlier evidence, and after verification of the committed head. Use the exported guard for observation without invoking a publishing/landing CLI. Include one real failing gate and show it stays red.

Record the exact implementation revision and trimmed outputs in the implementation review evidence. Do not substitute synthetic integration results for this live-run evidence or claim it was performed during preparation. Release disposable resources after the proof; do not reset another worker's marker.

## Follow-ups

No new policy fork is required. If the behavioral tests expose a runtime defect, report its observed failing sequence and re-scope the implementation to the actual source plus matching tests before changing production code. Broader retry-policy changes and a generic brief-lint framework are outside this item.

## Done when

The three targeted test files pass, and the brief-lint mutation controls fail when the cap, terminal outcome, or asynchronous-only executable commands are broken. The sibling test proves discovery plus its own default gate verdict; the finish test proves stale evidence cannot authorize delivery. Both live-lane proofs and the standards-gate result are attached to implementation review evidence.

## Progress

Preparation research corrected the original premise and scope:

- **Old premise:** `we:skills-src/conveyor/fix-agent-brief.md:336` and `we:skills-src/conveyor/fix-agent-brief.md:342` were async-gate citations, and bounded running retries still needed guarding. **Current evidence:** those line numbers now belong to preceding merge/build guidance; step 4 starts at line 345, with the 18-timeout cap and stop/report outcome at lines 362–367. Recent history includes commit `097e398e8` (feasible wait chunks and verification ownership). The cap exists; regression assertions and live-proof requirements remain owed. This is not an already-delivered item.
- **Old premise:** `we:scripts/operations/__tests__/dispatch-lane.test.mjs:2814` represented the coverage debt generally. **Current evidence:** that line is a plateau request-command assertion; whitespace-exact negative checks remain at lines 2780 and 2794. Rendered text coverage alone cannot prove runner discovery or finish-guard behavior.
- **Old scope:** only `we:skills-src/conveyor/fix-agent-brief.md` and `we:scripts/operations/__tests__/dispatch-lane.test.mjs`. **Corrected scope:** retain both and add existing test homes `we:scripts/conveyor/__tests__/verify-dispatch.test.mjs` and `we:scripts/__tests__/pr-land-finish-guard.test.mjs`. The brief source has its matching test in scope; the remaining entries are test files themselves.
- **Source evidence:** `we:scripts/conveyor/verify-dispatch.mjs:406` scans pools and dispatches requested lanes; its existing test round trip uses an explicit trivial gate, not sibling default selection. `we:scripts/lib/verify-lane-gate.mjs:84` composes repository-specific gate commands. `we:scripts/pr-land.mjs:638` exports the finish decision used by the existing real-Git tests, whose markers are currently written by fixture helpers. These existing seams support deterministic prevention coverage without a production redesign.

Preparation used source inspection only. No implementation tests or live proof have been claimed, and no preparation stamp was added.
