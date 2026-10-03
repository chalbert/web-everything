---
bornAs: xkoqlar
kind: story
size: 2
status: open
scope: ["we:scripts/lib/jury-core.mjs", "we:scripts/operations/review-pr.mjs", "we:scripts/operations/review-pr-io.mjs", "we:scripts/lib/__tests__/jury-core.test.mjs", "we:scripts/operations/__tests__/review-pr.test.mjs", "we:scripts/operations/__tests__/review-pr-io.test.mjs", "we:scripts/conveyor/reconcile-core.mjs", "we:scripts/conveyor/__tests__/reconcile-core.test.mjs"]
dateOpened: "2026-10-02"
preparedDate: "2026-10-02"
preparedAgainstSha: "db195c03bb8261ebe6f13741eb44ce2f3f366bee"
tags: []
---

# A block ruling on a mandatory referral sends the PR back for changes instead of re-asking

A valid independent `block` ruling for the current head must complete the review with an actionable changes verdict: the author receives the finding and its ruling rationale, the fixer can consume the bounce, and the unchanged head is not automatically re-reviewed before a new push. Preserve unrelated holds and human authority.

## Progress

Preparation checked the brief on main and the current implementation. The original card reported PR #3490 receiving a real block ruling, ending with “mandatory finding-specific review required”, and being dispatched 33 times. Those historical counts and the exact cause are **reported context, not independently verified evidence**. Its cited responder file, `we:scripts/conveyor/health-responder-state.mjs:51`, is absent in this checkout; do not treat that historical 32 MiB allegation as a current-code diagnosis. Obtain the pinned incident artifacts for the replay below.

Old premise/scope: block rulings do not end the run, with fixes confined to the jury core, review declaration, and core tests. Corrected premise: the core already separates a valid independent current-head block from pending obligations (`we:scripts/lib/jury-core.mjs:2318`), and the declaration already selects changes when blocked with no pending referral and no existing needs-human verdict (`we:scripts/operations/review-pr.mjs:2466`). The durable sink reuses covered same-head keys and skips attempted records (`we:scripts/operations/review-pr-io.mjs:530`, `we:scripts/operations/review-pr-io.mjs:548`). Do not replace these working mechanisms with another retry policy.

The remaining handoff gap is concrete: aggregate state returns records and blocked keys (`we:scripts/lib/jury-core.mjs:2378`), but the declaration carries only pending/blocked keys into the verdict (`we:scripts/operations/review-pr.mjs:2474`). The final write-up renders panel findings and the decision without transporting the referral ruling rationale (`we:scripts/operations/review-pr.mjs:1508`, `we:scripts/operations/review-pr.mjs:1534`). On a restart where the panel no longer repeats the finding, the existing reasonless-bounce guard also requires attention (`we:scripts/operations/review-pr.mjs:1634`). The generic referral comment's fallback reason remains pending-sounding even for a completed block (`we:scripts/lib/jury-core.mjs:2341`); this wording is not proof that the underlying state is pending.

Scope now includes the durable I/O and operation tests plus reconciliation and its tests, so completion is verified beyond confirmation. The current durable-ruling test stops at confirmation/verdict assertions (`we:scripts/operations/__tests__/review-pr.test.mjs:3719`). Reconciliation already maps bounced work to fix (`we:scripts/conveyor/reconcile-core.mjs:349`) and refuses a fix without findings (`we:scripts/conveyor/reconcile-core.mjs:2152`). Change reconciliation only if the completed-bounce replay demonstrates a remaining dispatch defect. Related card 4815 / reported PR #3507 owns the not-real/tool-less verification work; this card must preserve its authority rules rather than introduce a competing confidence policy.

## Design

1. Carry validated blocking referral details into the final verdict: exact key, original finding, active ruling, rationale, evidence, reviewer identity, and reviewed head. Derive these from the existing validated records and active-ruling resolution, not by parsing display prose or trusting raw `result: block` values. Preserve identity, independence, head, subject, and supersession checks (`we:scripts/lib/jury-core.mjs:2285`, `we:scripts/lib/jury-core.mjs:2318`, `we:scripts/lib/jury-core.mjs:2388`). Keep the durable record format compatible.
2. When all referral obligations are resolved and at least one is blocked, retain the existing changes verdict and complete its ordinary record path. Render the blocking finding and rationale in the changes body, including when only the persisted referral retains the finding on restart. Keep panel lens votes honest; a referral ruling is separate evidence, not an invented panel vote. Deduplicate by the existing exact finding key (`we:scripts/lib/jury-core.mjs:2270`). Satisfy the reasonless-bounce guard with validated actionable evidence, never an invented operator override (`we:scripts/operations/review-pr.mjs:1634`).
3. Render resolved referral status truthfully in the structured-record comment. Coordinate this small shared rendering change with 4815, which also targets the fallback at `we:scripts/lib/jury-core.mjs:2341`.
4. Preserve fail-closed behavior: unresolved or invalid referrals retain the hold, and blocked referrals cannot authorize acceptance (`we:scripts/operations/review-pr.mjs:1614`). Do not override an unrelated needs-human verdict or clear a human gate merely because one referral blocks (`we:scripts/operations/review-pr.mjs:2475`). Exercise the ordinary unattended changes answer through the existing policy (`we:scripts/lib/review-loop-policy.mjs:131`).
5. Complete the existing bounce-to-fixer route, then prove repeated reconciliation ticks do not schedule another review of that unchanged completed head. Use the real published body and labels as inputs; no acceptance marker fabricated for a rejection. The existing acceptance-marker guard is not a changes-completion marker (`we:scripts/conveyor/reconcile-core.mjs:2128`). A new head remains eligible for fresh review and cannot inherit old clearance (`we:scripts/lib/jury-core.mjs:2385`).

## MVP

Implement the validated ruling-to-write-up handoff and accurate referral status, with one synthetic #3490-shaped replay through the operation engine, durable sink, changes publication, and reconciliation. Cover restart with an existing block even when fresh jurors omit that finding. Repair only dispatch wiring demonstrated broken by that replay. No responder-journal implementation, new daemon, review-budget policy, or broad finding-identity redesign belongs here.

## Test plan

- Extend `we:scripts/lib/__tests__/jury-core.test.mjs:1571` for resolved-block display and validated detail transport. Retain stale head, invalid identity, missing/unreadable card, malformed records, and conflicting/superseded ruling controls already exercised at `we:scripts/lib/__tests__/jury-core.test.mjs:1592`.
- Extend `we:scripts/operations/__tests__/review-pr.test.mjs:3719` through confirmation, staging, and recording. Assert changes, actionable original finding plus ruling rationale/evidence, and no acceptance. Replay a persisted block with clean fresh panel answers; do not trip the reasonless-bounce guard or lose the finding. Mixed block plus unresolved referral must retain the hold; unrelated needs-human must remain human-owned.
- Extend the sink harness at `we:scripts/operations/__tests__/review-pr-io.test.mjs:1013` with block reuse across fresh run IDs and sink instances. Assert one mandatory judge attempt, read-back before consequential publication, recovery after interrupted publication, and no false completion after post/read-back/head-change failure (existing controls at `we:scripts/operations/__tests__/review-pr-io.test.mjs:1044`).
- Extend the bounced-work cases at `we:scripts/conveyor/__tests__/reconcile-core.test.mjs:703` using the actual rendered changes comment and resulting labels. Assert eligible fix dispatch, no duplicate fix while it is live, no same-head review over repeated ticks, and fresh review eligibility after a fix pushes and rearms a new head. Preserve caps and liveness controls.
- **Must on error:** malformed, stale, conflicting, unauthorized, missing, or unreadable ruling evidence never authorizes acceptance or falsely records completed referral review. A valid block cannot clear another pending key.
- **Must for non-code:** parameterize source, docs, config, and data findings. All receive the same authority/head checks and actionable changes handoff; file type grants no exemption.

## Proof plan

Run the four scoped Vitest suites: `we:scripts/lib/__tests__/jury-core.test.mjs`, `we:scripts/operations/__tests__/review-pr.test.mjs`, `we:scripts/operations/__tests__/review-pr-io.test.mjs`, and `we:scripts/conveyor/__tests__/reconcile-core.test.mjs`. Record the commands and results here during implementation. The new rationale-in-final-body and persisted-block-with-clean-panel assertions must fail before the change and pass after; the existing block-to-changes assertion is a control, not new proof.

Capture the replay's durable snapshots, reviewer call count, effective verdict, complete changes body, label transitions, fix dispatch, repeated-tick decisions, and new-head behavior. Exercise real operation/sink/planner code with injected forge effects; a predicate-only test cannot prove the handoff. Run the lane verifier through `we:scripts/verify-lane.mjs` and the standards gate.

If historical #3490 artifacts are available, replay its pinned head, juror output, structured ruling history, and comments read-only. Compare actual pending keys and publication outcomes with the synthetic replay. Until then, label the replay synthetic and leave the incident's exact cause unproven. No live PR mutation is part of this proof.

## Done when

The four scoped suites pass, including the new red-to-green handoff regressions: valid current-head block yields a completed actionable changes bounce, the fixer receives the finding and rationale, restart reuses the ruling, and repeated ticks do not re-review that head before a new push. Error, human-authority, and non-code controls remain green, as do the lane verifier and standards gate.

## Follow-ups

Obtain and reconcile the historical #3490 artifacts and claimed 33 dispatches; distinguish review runs from the pending/attempted/completed snapshots written by one attempt (`we:scripts/operations/review-pr-io.mjs:539`, `we:scripts/operations/review-pr-io.mjs:550`, `we:scripts/operations/review-pr-io.mjs:580`). Coordinate the shared status renderer with 4815. Record testing lessons here, not in shared agent documentation. Any new confidence policy, changed human authority, or heuristic merging of different finding keys needs separate scope and a decision rather than being smuggled into loop suppression.
