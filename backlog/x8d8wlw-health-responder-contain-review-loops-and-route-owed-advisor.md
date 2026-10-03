---
kind: story
size: 8
parent: "xdmqryh"
status: open
blockedBy: ["xuznx3v"]
scope: ["we:scripts/operations/health-responder-review.mjs", "we:scripts/operations/__tests__/health-responder-review.test.mjs", "we:scripts/conveyor/health-responder.mjs", "we:scripts/conveyor/__tests__/health-responder.test.mjs", "we:scripts/conveyor/health-smells/repeated-pr-attempts.mjs", "we:scripts/conveyor/health-smells/__tests__/repeated-pr-attempts.test.mjs", "we:scripts/conveyor/health-pr-attempts.mjs", "we:scripts/conveyor/health-watch.mjs", "we:scripts/conveyor/__tests__/health-watch.test.mjs", "we:scripts/operations/review-job.mjs", "we:scripts/operations/__tests__/review-job.test.mjs", "we:scripts/conveyor/stand-down.mjs", "we:scripts/conveyor/__tests__/stand-down.test.mjs", "we:scripts/conveyor/__tests__/reconcile-core.test.mjs", "we:scripts/conveyor/__tests__/fixtures/health-responder/review-loops.json", "we:scripts/review-set-label.mjs", "we:scripts/__tests__/review-set-label.test.mjs", "we:scripts/conveyor/fix-procedure.mjs", "we:scripts/conveyor/__tests__/fix-procedure.test.mjs"]
dateOpened: "2026-10-02"
preparedDate: "2026-10-02"
tags: [conveyor, health]
---

# Health responder: contain review loops and route owed advisories

Implement the disabled review adapter from epic #xdmqryh. Count trusted mandatory-referral runs per head; route block rulings to changes and repeated nonblocking/tool-less referrals to withdrawn draft, with the normal review path below cap. Never clear review:human, accept, answer a stand-down or reset a round cap. Replay #3432 51 mandatory-owner comments from 17 distinct runs and its stale red-team note, plus #3311 rearm/stand-down events. Grounding: we:scripts/conveyor/health-pr-attempts.mjs:70; we:scripts/operations/review-job.mjs:416; we:scripts/conveyor/stand-down.mjs:398.


## Implementation contract

Slice 5 of epic #xdmqryh. Apply its full action catalogue, safety, escalation and measurement contract in we:backlog/xdmqryh-health-responder-a-daemon-that-acts-on-health-signals-not-on.md. The current-source references below establish existing behavior; proposed files/limits describe work still owed.

Add disabled review routing/containment, with detection in the watch. The operator requirement of 2026-10-02 is folded into this contract: applying a trusted block ruling through changes and withdrawing a looping PR are permitted; the responder never invents a verdict or grants approval.

- The sole new review-loop detector counts trusted `mandatory-referrals-v1` records, deduplicated by repo/PR/head/runId, in a rolling two-hour window. Three distinct runs on the same head without a final verdict open a high-severity episode; repeated owner comments/edits for one run count once. This supersedes five completed attempts in 60 minutes. Completion of a whole review job is not required for a stuck mandatory referral. Join producer identity, operation run and reviewed head; quoted/forged markers, missing provenance or partial threads are unknown, not evidence. Keep bounded timestamped evidence, benign-wait exclusions and a separate estimate of cost with its rate/source; historical operator comment counts are not normalized run counts. Detection remains in the existing watch/repeated-pr-attempts owner.
- For owed-advisory coverage (not as a prerequisite for referral containment), require the actual trusted `ADVISORY_NOTE_MARKER` plus a non-degraded reviewed basis; reuse the existing advisory parser/coverage predicate, and separately recognize converted advisories through their existing predicate. Do not look for an invented `advisory-sha` field. Sources: we:scripts/operations/review-pr.mjs:1814; we:scripts/conveyor/advisory-round-count.mjs:49; we:scripts/lib/advisory-labels.mjs:93; we:scripts/lib/review-escalation.mjs:1424.
- Read the existing reconcile plan for the nominated PR. Below the actual durable cap, one owed advisory/review may use `dispatchReviewByMode`, reusing the same job-slot claim and independent reviewer path as the normal daemon (we:scripts/operations/review-job.mjs:416, we:scripts/operations/review-job.mjs:574). Add expected-head/episode guards at that owner if necessary, not a second dispatcher. On a human PR it runs the established advisory path and leaves the human label untouched.
- At the threshold, inhibit further responder review dispatch and read finding-specific rulings from the trusted mandatory-review owner record for this head/run. Preserve supersedes lineage and refuse unresolved/conflicting provenance. A recorded `block` ruling for a real defect goes through we:scripts/review-set-label.mjs `--to=changes` once with a fixed-format, scrubbed body naming the finding and required repair. This applies an existing ruling; the responder does not judge whether prose is a defect. A contradiction inside backlog cards is escalated with the finding, never edited by the responder; a trusted block can still be routed to changes.
- Re-asked `not-real`/`card` rulings, or verified tool-less-juror provenance, withdraw the looping PR through we:scripts/conveyor/fix-procedure.mjs `fix-begin --draft --reason=withdrawn`, then escalate. An allegation in comment prose is not tool-less provenance. Acquire only the responder's own stable episode-scoped `who` and owner token, after refusing any live foreign claim/worker. Persist claim identity before submission; use owner-token-checked release for this own claim only. Claim expiry/release does not clear the durable withdrawal hold. Never forge the original fixer's identity or call fix-end on another claimant.
- Preserve `review:human` and durable history in every route. `changes` may alter verdict/status labels only through the shared writer while retaining the human hold; if that combination is unsupported, fail closed and extend the existing owner with tests. Never accepted/restamp/clear-human, no comment deletion or round reset. The changes/draft routes replace automatic terminal stand-down for this referral subtype. Other exhausted review/fix episodes still use one existing terminal stand-down after verifying no live worker; never stack it over the same referral containment or synthesize its operator answer.
- Resume only after an explicit operator resolution identifies the episode, PR, cause and current head and fresh evidence confirms that cause is fixed. Only the responder marks a cause fixed, and only from evidence it reads itself: the cause card's `status: resolved` on `main` (or the named fix merged on `main`), re-read at the current head. An agent's “fixed” message, a PR comment or an operator's resolution text alone is insufficient: the operator resolution authorizes the resume, and the responder's own read of `main` establishes the cause is fixed. Release only this responder's claim/withdrawal through its owning ceremony; unresolved independent stand-down/human holds remain. Re-enter `runReconcilePromoteDraftDispatch` with current checks and expected-head guards, never direct ready mutation or fix-end ready bypass. No promotion if the owner cannot safely distinguish and clear this specific withdrawal.
- A1/P and the kill switch cover every branch, including changes, claim/draft, own-claim release and resume. Maximum one requested review job per PR/head, one changes or withdrawal containment per episode/head (mutually exclusive), one own-claim release and one guarded resume per resolved episode; other exhausted episodes get one terminal stand-down. Account separately for every external effect under shared hourly/daily caps; if the workflow stops between steps it stays held. Ambiguous submissions are never retried. Every action has a decision-log record and scrubbed PR comment. A current advisory is no-op for the owed-advisory route, not proof that a separate unresolved referral is fixed.

## Scope boundary

18 scope paths, three areas: we:scripts/operations/, we:scripts/conveyor/ and the shared label writer/tests in we:scripts/. Frontmatter is the explicit predicted touch set; do not widen it silently. Backlog delivery metadata is administrative, not another implementation area. Read-only references outside scope are not permission to edit those files. No shared agent-document edits. Changes to existing shared actuators stay in their existing owner, with their existing tests.

This is independently deliverable after slice 1: the adapter and its detector extension land disabled, with injectable contract tests; actual live enablement belongs to slice 6. The shared responder-shell path intentionally makes overlapping sibling wiring serialize in the lane planner.

## Test plan and replay

R1 (#3432): 51 mandatory-owner comments -> 17 distinct runs; partition by head before applying cap. The old red-team note at head 2498e55… cannot satisfy the current 495e86a… advisory. At three distinct trusted runs within two hours, apply the trusted block or withdrawal route once and assert the ordinary planner honors that containment; below-cap synthetic variant starts one advisory job with the human hold retained. Test one run with three owner records (no threshold), boundary timestamps, changed heads, and cost labeled as estimate. Separately replay non-referral cap exhaustion through stand-down. D2 (#3311) supplies repair rearm, concurrent-author pause and terminal judgment cases. Forged/quoted markers, incomplete threads, new head, live worker, current advisory and an agent claiming operator approval all refuse unsafe actions.

Add explicit cases for block → changes retaining human; card/not-real/tool-less → draft under the responder's own claim; forged/superseded/conflicting rulings; foreign claims; timeout/restart; cap reached between claim and draft; cause-fixed spoof; operator resolution with pending checks; and ready only via the promotion owner. Assert no card/code writes and no approval/clear-human/merge/force-push.

Primary executable checks (new test entrypoints are expected to be absent before this story):

```bash
responder_test_1='we:scripts/operations/__tests__/health-responder-review.test.mjs'
responder_test_2='we:scripts/conveyor/health-smells/__tests__/repeated-pr-attempts.test.mjs'
responder_test_3='we:scripts/operations/__tests__/review-job.test.mjs'
responder_test_4='we:scripts/conveyor/__tests__/stand-down.test.mjs'
responder_test_5='we:scripts/conveyor/__tests__/reconcile-core.test.mjs'
npx vitest run "${responder_test_1#we:}" "${responder_test_2#we:}" "${responder_test_3#we:}" "${responder_test_4#we:}" "${responder_test_5#we:}"
responder_extra_0='we:scripts/conveyor/__tests__/health-watch.test.mjs'
responder_extra_1='we:scripts/__tests__/review-set-label.test.mjs'
responder_extra_2='we:scripts/conveyor/__tests__/fix-procedure.test.mjs'
npx vitest run "${responder_extra_0#we:}" "${responder_extra_1#we:}" "${responder_extra_2#we:}"
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
