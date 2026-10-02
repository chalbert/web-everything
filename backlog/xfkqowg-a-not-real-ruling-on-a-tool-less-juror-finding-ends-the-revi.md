---
kind: story
size: 3
status: open
scope: ["we:scripts/lib/jury-core.mjs", "we:scripts/operations/review-pr.mjs", "we:scripts/lib/__tests__/jury-core.test.mjs", "we:scripts/operations/review-pr-io.mjs", "we:scripts/operations/__tests__/review-pr.test.mjs", "we:scripts/operations/__tests__/review-pr-io.test.mjs", "we:scripts/conveyor/reconcile-core.mjs", "we:scripts/conveyor/__tests__/reconcile-core.test.mjs"]
dateOpened: "2026-10-02"
preparedDate: "2026-10-02"
preparedAgainstSha: "4fd3538faae1e5c5c251a88766bb176d01f33e38"
tags: []
---

# A not-real ruling on a tool-less juror finding ends the review run, so a review:human PR gets its advisory instead of looping

Make unsupported tool-less confirmation non-authoritative, preserve a valid finding-specific `not-real` closure for the reviewed head, and stop automatic duplicate review after the advisory completes. Replay the reported PR #3432 shape: one run, one advisory, no repeat dispatch for unchanged completed work.

## Progress

Preparation checked the current checkout against the brief on main. Original incident report: PR #3432 allegedly ran about 17 times (51 mandatory-owner comments) overnight on 2026-10-02; an Antigravity finding claimed a typo at `we:scripts/operations/pr-status.mjs:179` while admitting no mutation tools. These counts, the historical diff, and the owner's actual ruling are **reported context, not independently verified evidence**. Do not infer failure from comment count: one attempt deliberately persists pending, attempted, and completed snapshots (`we:scripts/operations/review-pr-io.mjs:539`, `we:scripts/operations/review-pr-io.mjs:550`, `we:scripts/operations/review-pr-io.mjs:580`). The cited typo location is a historical allegation, not a current defect citation.

Old premise: a recorded `not-real` ruling does not close a finding, with fixes confined to the jury core and review operation plus core tests. Corrected premise: valid independent current-head `not-real` already clears the referral obligation (`we:scripts/lib/jury-core.mjs:2318`); the sink reuses covered keys and skips spent attempts (`we:scripts/operations/review-pr-io.mjs:530`, `we:scripts/operations/review-pr-io.mjs:548`). Existing operation tests cover successful rulings (`we:scripts/operations/__tests__/review-pr.test.mjs:3719`). The generic rendered reason still says “mandatory finding-specific review required” even on a successful record without a failure (`we:scripts/lib/jury-core.mjs:2341`); that text alone is not proof of a pending hold.

The remaining admission gap is concrete: `requiresMandatoryReferral` trusts verdict and impact alone (`we:scripts/lib/jury-core.mjs:2264`), and the reducer collects referrals before citation scoping (`we:scripts/operations/review-pr.mjs:2350`). Antigravity is explicitly tool-free yet receives the shared judge schema (`we:scripts/operations/review-pr.mjs:1408`, `we:scripts/operations/review-pr.mjs:1484`). Pending referrals suppress the human advisory (`we:scripts/operations/review-pr.mjs:2492`). The general same-head guard compares an acceptance marker (`we:scripts/conveyor/reconcile-core.mjs:1168`); advisory coverage has an existing helper (`we:scripts/lib/advisory-labels.mjs:116`). Thus scope now includes the durable sink, reconciliation, and their tests, rather than assuming the core alone owns completion.

Observed baseline: the three suites at `we:scripts/lib/__tests__/jury-core.test.mjs:1572`, `we:scripts/operations/__tests__/review-pr.test.mjs:3637`, and `we:scripts/operations/__tests__/review-pr-io.test.mjs:1013` passed, 575 tests total. This proves existing covered behavior, not reproduction of the live incident. No implementation changed during preparation.

## Design

1. Normalize confidence at the review admission boundary using the actual seat capability, before referral selection. A known tool-less seat's `CONFIRMED` becomes effective `PLAUSIBLE`; retain its original assertion and provenance for display/audit. Do not infer capabilities from finding prose or merely from an omitted `allowedTools`: the correctness-advisory seat has a read-only shell despite that omission (`we:scripts/operations/review-pr.mjs:1368`). Keep the shared referral predicate's legacy-record validation compatible; old records must remain readable (`we:scripts/lib/jury-core.mjs:2291`). Unknown capability must not silently clear an existing obligation.
2. Preserve append-only current-head ruling semantics. A valid independent `not-real` closes only its exact finding key; other pending or blocked findings still govern the run (`we:scripts/lib/jury-core.mjs:2318`). Exercise the complete human-advisory path through persisted read-back and verdict reduction, repairing only a reproduced wiring defect. Render resolved status accurately instead of the unconditional pending-sounding fallback (`we:scripts/lib/jury-core.mjs:2341`). Never erase historical referrals to make the advisory run.
3. Extend automatic duplicate suppression to a completed advisory for the current repository/PR/head using the existing advisory parser/coverage helper (`we:scripts/lib/advisory-labels.mjs:116`). Completion requires the published note and matching outcome label; a partial publication needs recovery, not a false completed state. Preserve ordered note-before-label effects (`we:scripts/operations/review-pr.mjs:2493`, `we:scripts/operations/review-pr.mjs:2523`). Keep existing new-head and explicit repair/review obligations intact (`we:scripts/conveyor/reconcile-core.mjs:1962`, `we:scripts/conveyor/reconcile-core.mjs:1990`); the target is repeated automatic review of unchanged completed work.

## MVP

Implement capability-aware admission, truthful referral status rendering, and advisory completion recognition in the scoped files. Add one synthetic #3432-shaped replay spanning a human-gated review, durable referral snapshots, advisory effects, and subsequent reconciliation ticks. Cover both a new tool-less finding (downgraded before referral) and a pre-existing confirmed referral closed by `not-real`. Reuse the current durable record format and publication sequence. Do not implement a new review service, retry budget, or authority policy.

## Test plan

- Extend `we:scripts/lib/__tests__/jury-core.test.mjs:1572` for effective confidence and resolved rendering, retaining invalid identity, supersession, and head-change cases at `we:scripts/lib/__tests__/jury-core.test.mjs:1597`.
- Extend `we:scripts/operations/__tests__/review-pr.test.mjs:3637` with tool-less CONFIRMED broken/unrecoverable findings, a capable control, and a `review:human` replay. Assert original evidence remains visible; valid legacy `not-real` permits exactly one advisory note and matching label while preserving human control. Mixed findings must not clear unrelated blockers.
- Extend the durable harness at `we:scripts/operations/__tests__/review-pr-io.test.mjs:1013` for restart, publication/read-back failure, changed head, malformed record, wrong reviewer, conflicting rulings, and missing/unreadable card. Assert spent attempts do not spawn again and partial effects never count as completed.
- Extend `we:scripts/conveyor/__tests__/reconcile-core.test.mjs:3033` with repeated ticks after the completed human advisory, missing/mismatched label, old-head advisory, and a new head. Keep acceptance-marker conversion and repair obligations covered.
- **Must on error:** retain the hold for missing, malformed, conflicting, unauthorized, or stale evidence; a downgrade must not erase a durable pending referral (`we:scripts/lib/jury-core.mjs:2378`).
- **Must for non-code:** parameterize source, docs, config, and data findings. Capability normalization applies equally; valid independent blockers on any input kind remain blockers. A file extension never grants acceptance.

## Proof plan

Run the four scoped suites together with Vitest (the existing three plus reconciliation). The newly added tool-less confidence and repeated-tick regression assertions must fail against the pre-change implementation and pass after it; already-passing `not-real` tests are controls, not claimed red-to-green proof. Record test names and outputs here.

Use the operation engine and injected sink harness, not just isolated predicates: capture effect order, persisted snapshots, effective verdict, preserved human label, advisory count, and the next two dispatch plans. Inject publication failure between note and label and show recovery without claiming completion prematurely. Then run the required lane verifier and standards gate.

If historical #3432 data is available, replay its pinned head, diff, juror output, structured ruling, and comments read-only through that harness. Compare actual pending keys with the synthetic case. Until those artifacts are obtained, label the case synthetic and leave the historical loop's exact cause unproven; do not post to the live PR as part of proof.

## Done when

The four scoped Vitest suites pass with the new red-to-green assertions: tool-less confirmation is non-authoritative, a valid existing `not-real` closes its own current-head obligation, the human advisory publishes once, and unchanged completed work produces no further automatic review dispatch. All refusal and non-code controls above still pass; the lane verifier and standards gate pass.

## Follow-ups

Capture the historical #3432 artifacts if accessible and reconcile reported run/comment counts with persisted snapshots. Put any replay or testing lessons here, not in shared agent documentation. Broader finding-identity changes (the current key includes normalized summary text at `we:scripts/lib/jury-core.mjs:2273`) require separate evidence and scope; this card must not merge different findings heuristically to suppress a loop.

## Root cause found (orchestrator, 2026-10-02 ~7:30 AM ET)

Decoded the 51 `mandatory-referrals-v1` records on #3432. Each round writes three records under ONE fresh mandatory reviewer id (e.g. a30c21ad at 10:10Z, f6d233a7 at 09:33Z): opened, attempted, then a `not-real` ruling on the same head (495e86acb). The record then says "start a fresh review-pr"; the fresh run opens a NEW record with a NEW reviewer id and EMPTY rulings, and the referral check in we:scripts/lib/jury-core.mjs (around line 2320) reads only the current record's rulings, so the finding is pending again and the tool-less juror re-raises it. Rulings never carry across runs, so the run never reduces to a verdict and the advisory step never posts. Fix: a ruling on the same finding key for the same head carries into later runs (with the independence check still applied to the ruling's own reviewer), and a tool-less juror's finding cannot be CONFIRMED.

## Operator ruling (2026-10-02, via claude-code-chat: "ok")

Add a confirmation turn: when a juror without tools reports a finding as CONFIRMED broken, a tool-bearing verifier gets one turn to reproduce it on the PR head before it counts. Reproduced: it stays CONFIRMED and needs a ruling as today. Not reproduced: it is downgraded to an advisory note and never blocks the run. Cost is paid only when such a claim is made. Giving read-only tools to every reviewer stays a later option, not part of this card.

## Reopened (2026-10-02 ~7:50 AM ET)

The drain marked this card resolved when PR #3477 landed, because that PR's title began "WE xfkqowg:" — but #3477 only added the root cause to the card; nothing was built. Reopened.

Also binding, found when the operator approved #3432 ("I approve 3432", 2026-10-02): the human ceremony itself (we:scripts/review-set-label.mjs --to=clear-human, assertMandatoryReferralsCleared) refuses while the tool-less juror's false referral is pending, and there is no path for the operator to rule on it. The fix must let an explicit operator instruction record the finding-specific ruling (not-real / card / block) on the PR, so a human approval is never deadlocked by a juror's unverifiable claim.
