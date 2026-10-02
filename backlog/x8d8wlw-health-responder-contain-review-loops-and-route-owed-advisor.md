---
kind: story
size: 8
parent: "xdmqryh"
status: open
blockedBy: ["xuznx3v"]
scope: ["we:scripts/operations/health-responder-review.mjs", "we:scripts/operations/__tests__/health-responder-review.test.mjs", "we:scripts/conveyor/health-responder.mjs", "we:scripts/conveyor/health-smells/repeated-pr-attempts.mjs", "we:scripts/conveyor/health-smells/__tests__/repeated-pr-attempts.test.mjs", "we:scripts/conveyor/health-pr-attempts.mjs", "we:scripts/conveyor/health-watch.mjs", "we:scripts/conveyor/__tests__/health-watch.test.mjs", "we:scripts/operations/review-job.mjs", "we:scripts/operations/__tests__/review-job.test.mjs", "we:scripts/conveyor/stand-down.mjs", "we:scripts/conveyor/__tests__/stand-down.test.mjs", "we:scripts/conveyor/__tests__/reconcile-core.test.mjs", "we:scripts/conveyor/__tests__/fixtures/health-responder/review-loops.json"]
dateOpened: "2026-10-02"
preparedDate: "2026-10-02"
tags: [conveyor, health]
---

# Health responder: contain review loops and route owed advisories

Implement the disabled review adapter from epic #xdmqryh. Extend watch evidence to count distinct completed same-head advisory attempts; reuse the normal reconcile/review-job path below cap and stand-down at exhaustion. Never clear review:human, accept, answer a stand-down or reset a round cap. Replay #3432 51 mandatory-owner comments from 17 distinct runs and its stale red-team note, plus #3311 rearm/stand-down events. Grounding: we:scripts/conveyor/health-pr-attempts.mjs:70; we:scripts/operations/review-job.mjs:416; we:scripts/conveyor/stand-down.mjs:398.


## Implementation contract

Slice 5 of epic #xdmqryh. Apply its full action catalogue, safety, escalation and measurement contract in we:backlog/xdmqryh-health-responder-a-daemon-that-acts-on-health-signals-not-on.md. The current-source references below establish existing behavior; proposed files/limits describe work still owed.

Add disabled review routing/containment, with detection in the watch and no review verdict authority in the responder.

- Extend watch attempt evidence with distinct completed current-head review job/run IDs whose required advisory did not appear; five such runs in 60 minutes opens the proposed subtype. Do not count three mandatory-owner comments from one UUID as three runs. The existing effect reader omits successful first review effects (we:scripts/conveyor/health-pr-attempts.mjs:70), and existing benign-wait exclusions must survive (we:scripts/conveyor/health-pr-attempts.mjs:14). Incomplete run/comments/head facts are unknown, not no-advisory proof. Join the existing operation records read by we:scripts/conveyor/health-watch.mjs:157 to durable completion/run/basis metadata; the live slot disappears on completion (we:scripts/operations/review-job.mjs:490). Extend the existing completion report with missing head/run provenance as needed, never infer completion from the mandatory-owner comment. Preserve a bounded timestamped window in watch evidence and never count rereads of one cached observation. Extend the PR projection’s head/coverage fields here when slice 2 has not landed yet; the shared shell scope serializes that overlap (we:scripts/conveyor/health-watch.mjs:518).
- Require the actual trusted `ADVISORY_NOTE_MARKER` plus a non-degraded reviewed basis; reuse the existing advisory parser/coverage predicate, and separately recognize converted advisories through their existing predicate. Do not look for an invented `advisory-sha` field. Sources: we:scripts/operations/review-pr.mjs:1814; we:scripts/conveyor/advisory-round-count.mjs:49; we:scripts/lib/advisory-labels.mjs:93; we:scripts/lib/review-escalation.mjs:1424.
- Read the existing reconcile plan for the nominated PR. Below the actual durable cap, one owed advisory/review may use `dispatchReviewByMode`, reusing the same job-slot claim and independent reviewer path as the normal daemon (we:scripts/operations/review-job.mjs:416, we:scripts/operations/review-job.mjs:574). Add expected-head/episode guards at that owner if necessary, not a second dispatcher. On a human PR it runs the established advisory path and leaves the human label untouched.
- At an actual cap or the new completed-advisory-loop threshold, inhibit responder retries and, after verifying no live worker, post one terminal stand-down through we:scripts/conveyor/stand-down.mjs:398. Include episode/head/run count and the missing artifact in detail. No fabricated repair/finding, no synthetic operator answer. The normal planner must then refuse the same episode via we:scripts/conveyor/reconcile-core.mjs:1491; test that path end-to-end with the resulting comment. If a refusal is infrastructure/permission, name the owning repair rather than mislabel it as a reviewer judgment.
- Preserve all original labels and durable markers. Never accepted/restamp/clear-human, no comment deletion, no round-count reset, no resuming a worker owned by another dispatcher. Existing explicit stand-down answer remains solely an operator ceremony (we:scripts/conveyor/stand-down-answer.md:3).
- A1/P apply; maximum one responder-requested review job per PR/head, one terminal stand-down for the unresolved episode/head. Two observed episodes or a restart cannot create another job. A fresh current-head advisory is no-op; starting a review is attendance, not successful recovery.

## Scope boundary

14 scope paths, two areas: we:scripts/operations/ and we:scripts/conveyor/. Frontmatter is the explicit predicted touch set; do not widen it silently. Backlog delivery metadata is administrative, not another implementation area. Read-only references outside scope are not permission to edit those files. No shared agent-document edits. Changes to existing shared actuators stay in their existing owner, with their existing tests.

This is independently deliverable after slice 1: the adapter and its detector extension land disabled, with injectable contract tests; actual live enablement belongs to slice 6. The shared responder-shell path intentionally makes overlapping sibling wiring serialize in the lane planner.

## Test plan and replay

R1 (#3432): 51 mandatory-owner comments -> 17 distinct runs; partition by head before applying cap. The old red-team note at head 2498e55… cannot satisfy the current 495e86a… advisory. At the bound, stand down once and assert the ordinary reconcile planner refuses; below-cap synthetic variant starts one advisory job with the human hold retained. D2 (#3311) supplies repair rearm, concurrent-author pause and terminal judgment cases. Forged/quoted markers, incomplete threads, new head, live worker, current advisory and an agent claiming operator approval all refuse unsafe actions.

Primary executable checks (new test entrypoints are expected to be absent before this story):

```bash
responder_test_1='we:scripts/operations/__tests__/health-responder-review.test.mjs'
responder_test_2='we:scripts/conveyor/health-smells/__tests__/repeated-pr-attempts.test.mjs'
responder_test_3='we:scripts/operations/__tests__/review-job.test.mjs'
responder_test_4='we:scripts/conveyor/__tests__/stand-down.test.mjs'
responder_test_5='we:scripts/conveyor/__tests__/reconcile-core.test.mjs'
npx vitest run "${responder_test_1#we:}" "${responder_test_2#we:}" "${responder_test_3#we:}" "${responder_test_4#we:}" "${responder_test_5#we:}"
npm run check:standards
lane_verifier='we:scripts/verify-lane.mjs'
node "${lane_verifier#we:}"
```

Use isolated temporary roots, mocked GitHub/actuator IO and injected clocks. Assertions must inspect the called existing owner, expected identity, durable receipt and preserved forbidden state; a snapshot of proposed prose alone is not evidence. No live host files or production PRs are mutated by replay.

## Done when

1. **Executable:** the primary checks above pass, including the named replay and negative/race cases. The implementation leaves the epic’s traceable receipt and uses the existing actuator boundaries.
2. **Must refuse on error:** missing/partial/stale facts, unknown authority/owner, changed head/lease, exhausted caps, terminal holds and kill/pause settings cannot reach a forbidden write. An ambiguous write is never automatically repeated.
3. **Must cover every input kind:** documentation, config, data, backlog and source inputs all retain the same review/ownership gates; no non-code exemption, synthetic approval or clearing of `review:human`.
4. **Observable:** the adapter is still disabled by default; a fixture replay proves its postcondition/refusal through the existing owner, and its future canary requirement is recorded in the epic.

## Follow-ups

Record replay limitations, observed product gaps and testing lessons here. Do not append to shared agent docs or silently add a new automatic action beyond the epic’s catalogue.

## Operator requirement (2026-10-02): act on review loops, not only report them

Live case the same morning: three PRs looped in the mandatory-referral review for hours (#3432 81 runs, #3490 33, #3481 30; about 74 runs since 9 AM ET at roughly $0.44 each) and the orchestrator stopped them by hand. Required:
- **Detector:** count `mandatory-referrals-v1` records per PR and head over a rolling window; N runs on one head with no verdict (proposed N = 3 within 2 hours) is a review-loop episode, high severity, with the run count and an estimated cost.
- **Classify the referral, then act (allowlisted):**
  - ruling `block` (a real defect) → send the PR back for changes through `we:scripts/review-set-label.mjs --to=changes` with a body naming the finding and what to fix (the orchestrator did this for #3490);
  - ruling `not-real` or `card` still re-asked, or a claim from a tool-less juror → pause review by moving the PR to draft with reason `withdrawn` through `we:scripts/conveyor/fix-procedure.mjs fix-begin --draft --reason=withdrawn` with a why naming the episode (the orchestrator did this for #3432), and escalate;
  - a real contradiction inside backlog cards (#3481) → escalate with the finding; never edit cards itself.
- Never records an approval, never clears review:human; resumes the PR (ready again) only when the episode's cause is marked fixed. Every action is a decision-log record and a PR comment.
