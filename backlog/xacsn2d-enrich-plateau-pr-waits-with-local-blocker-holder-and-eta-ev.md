---
kind: story
locus: plateau-app
size: 3
parent: "4623"
status: open
blockedBy: ["x6jc6u7"]
scope: ["plateau-app:src/wip/progress-prs.ts", "plateau-app:src/wip/progress-prs.test.ts", "plateau-app:src/wip/progress-waits.ts", "plateau-app:src/wip/progress-waits.test.ts", "plateau-app:src/wip/wip-read.ts", "plateau-app:src/wip/wip-read.test.ts"]
dateOpened: "2026-10-01"
tags: []
---

# Enrich Plateau PR waits with local blocker holder and ETA evidence

Attach observed queue blockers, shared files, holder age and conditional next steps to each PR from bounded local evidence. Estimate only from sufficient completed-run samples and preserve explicit unknown reasons when evidence cannot establish a chain.

## Design

Read bounded local daemon log tails, claim records and available run records through injected IO; resolve log locations from installed producer configuration, never assume checkout-local state. Recognize the cited repo-qualified refusal format and retain source offset/time. Parse only recognized queue reasons; an unrecognized format remains visible raw evidence with unknown structured fields. A log mtime is not a refusal timestamp. Rotation, undated text and incomplete passes invalidate claims about current order. Prefer newer trustworthy disposition over old refusal text; retain old text as historical evidence. Builds can be blockers too. Never re-run the dispatcher or query GitHub to reconstruct its queue.

Use `claimedAt` for holder age and heartbeat/lease expiry separately. Require repo/PR/session evidence for run joins; a PID or PR number alone is insufficient. A stale claim or missing handler becomes an explicit system-owned unknown, not an operator chore. Show the latest known wait and its observation age even when start time is unavailable.

Next steps are conditional descriptions of the observed route: for example overlap clears → fixer applies change → current-head CI → review → drain eligibility. They are not promises that every PR traverses every step. ETA is a display estimate only: from matching completed step records, take the median duration per needed step over a stated recent window, require at least three valid samples per estimated step, and add known serial predecessors' estimates. Report range/sample provenance; missing start/end, stale queue, cycles, insufficient samples or unknown human duration yields “ETA unknown” with reason. Never estimate from label age or claim TTL. Validate both computable and unknown ETA paths; collecting richer duration history is not a prerequisite to honestly displaying unknown today.

Implement the enrichment behind the collection adapter so transport can serialize the same optional/unknown-compatible contract without depending on log parsing. Add we:../plateau-app/src/wip/progress-waits.ts and its test; wire injected observation IO in the existing collector. Sanitize raw reasons and source refs before publication: retain useful unrecognized evidence, but redact/reject absolute host paths, home directories and transcript snippets. No producer edits or hidden history collector.

## Observed seam and scope

The insertion point is the injected progress IO / section failure boundary at we:../plateau-app/src/wip/wip-read.ts:445, with the predecessor's proposed we:../plateau-app/src/wip/progress-prs.ts as its collection home. Producer evidence was inspected at we:scripts/conveyor/reconcile-fix-dispatch.mjs:1450 (observed-pass ordering and blockers) and we:scripts/conveyor/fix-claim-store.mjs:38 (repo/kind/PR identity). we:scripts/conveyor/fix-claim-store.mjs:87 includes expired entries by default and may skip corrupt records; absence is not proved by a successful list alone. These producer paths remain read-only.

Budget: **6 implementation/test paths, 1 area** (we:../plateau-app/src/wip/), plus card close-out. New waits module/test are explicit additions at an observed injection seam. Reuse contract types; no wire shape redesign. Exact touch set is frontmatter scope. Transport can proceed independently because it owns disjoint files and handles chain evidence as contract data.

## Test plan / Done when

- **Capability — Red today expected (not executed during this backlog split):** Fixture the actual refusal text, shared directory/file, build blocker, multiple predecessors, stale order, rotated/partial/undated logs, malformed lines and same-number cross-repo collisions. Unknown formats retain sanitized raw evidence and an unknown structured reason.
- **Capability — Red today expected (not executed during this backlog split):** Test expired/reacquired claims, preserved versus reset claimedAt, old-head diagnostics and repo/PR/session run joins. Lease/heartbeat and log mtime never become wait start or proof of active execution.
- **Capability — Red today expected (not executed during this backlog split):** Prove known medians with at least three completed valid samples per step, stated window/range/provenance and serial predecessor sum. Missing endpoints, negative durations, cycles, stale order, insufficient history and unknown human wait yield reasoned unknown ETA.
- **Capability — Red today expected (not executed during this backlog split):** Assert no dispatch, GitHub, refresh or agent invocation and no absolute host paths/transcripts in enriched output. Snapshot sanitization covers both recognized and unrecognized reason text.
- **Capability — Red today expected (not executed during this backlog split):** Replay sanitized refusal plus contemporaneous claim/run fixtures through the real collector; observe a second pass clearing/changing the wait. Validate both computable ETA and real insufficient-history unknown. Existing published summary remains valid before the UI lands.

## Follow-ups

If installed logs cannot attest stable pass identity, timestamps or blocker refs, record that producer gap and propose its separate owner contract/implementation; keep this slice honest with unknown fields. Do not infer timestamps from mtime or estimate from claim TTL.

## Delivery boundary

This is one story under #4623; its prepared Design, MVP and Proof plan remain the umbrella acceptance. No implementation was performed while splitting. Reconcile predecessor interfaces before build and capture expected failing capabilities before changing code. All tests use sanitized fixtures, injected clock/IO and network/process spies, never live claims. A missing source means unknown with a reason. No new GitHub polling, approval, dispatch or merge behavior is authorized.

Build only the listed scope. Re-probe the touch set if upstream interfaces move; split again before exceeding 20 paths or 4 areas. Run the affected suites and the owning repository gate, recording commands, source identities and limitations on this card. Keep testing lessons in Follow-ups rather than shared agent docs.
