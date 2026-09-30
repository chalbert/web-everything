---
bornAs: xk6vumo
kind: story
locus: plateau-app
size: 5
status: open
blockedBy: ["4620"]
scope: ["plateau-app:src/wip/progress-prs.ts", "plateau-app:src/wip/progress-prs.test.ts", "plateau-app:src/wip/progress-read.ts", "plateau-app:src/wip/wip-view.ts", "plateau-app:src/wip/wip-view.test.ts", "plateau-app:src/wip/wip-decide.ts", "plateau-app:src/wip/wip-decide.test.ts", "plateau-app:scripts/wip-publish.ts", "plateau-app:wip-relay.js", "plateau-app:src/wip/wip-relay-contract.test.ts"]
dateOpened: "2026-09-30"
tags: []
---

# Show all three repos open PRs grouped by what each is waiting on

Keep every open PR across web-everything, plateau-app and frontierui visible regardless of author, card or branch name, and separate machine waits from human review. Full design: we:docs/agent/plateau-progress-view.md.
## Design

Follow we:docs/agent/plateau-progress-view.md. WE owns the declarative wire contract and examples; Plateau owns adapters, aggregation, relay and UI. Keep the existing publisher/relay, 120-second baseline, source ages and explicit unknown/partial states. No display-driven GitHub calls. One plain description per row, fully wrapped, never ellipsis. System-owned failures remain flow state.

## MVP

Add proposed plateau-app:src/wip/progress-prs.ts. Read persisted shared PR snapshots for all three repos through their state-home resolver; do not invoke the refresh-on-miss helper. Independent PR rows use repo plus number and retain all wait reasons. Primary groups: operator, draft author continuation, conflict, fix daemon, CI, review daemon, ready for drain, unknown. Apply the design precedence and exact-head evidence rules. Every PR remains reachable even with no card or unknown author. Show human review prerequisites and connect ready decisions to existing forks. Add bounded cached paging over the existing ask channel if payload limits require it.

## Done when

1. Fixtures containing an operator PR, cardless PR, two PRs on one card and duplicate numbers across repos retain all rows and correct totals.
2. Red draft belongs to author continuation; pending review belongs to daemon; review:human retains CI/advisory prerequisites without an early approval prompt.
3. Missing/truncated repo coverage is visible and never rendered as zero open PRs. All waits disclose owner and age.
4. No browser/publisher-triggered GitHub requests; extra tabs read the same published collection.

## Test and proof

Run focused PR adapter/view/relay/decision tests and phone a11y checks. Compare the rendered set to the exact local source snapshots by repo/number; verify cached paging union equals source membership. Test stale head checks, missing handler, unknown labels, out-of-order snapshots and relay reconnect. Event-ledger integration is deferred until #4281 is available; it is not needed for this cache-based slice.

## Readiness and follow-ups

Filed with `--queue=false`: design reviewed by the operator and producer seams proven during preparation before scheduling. No prepared stamp is claimed. Scope lists predicted files, including new adapters and tests; revise it during preparation if an existing producer needs a separate change. Record testing lessons and uncovered producer gaps here, not in shared agent docs.

Existing #4057 owns the Fleet PR panel. Reconcile its scope before dispatch and extend that panel if it has landed; this story replaces its automatic stale/orphan-to-Needs-you routing with explicit human escalation. The passive cache MVP does not need the refresh-budget ruling; any new shared refresh spending does.

## Operator addition (2026-09-30 ~11:30 AM ET)

Include the **per-PR waiting chain** (see we:docs/agent/plateau-progress-view.md, "Per-PR waiting chain"): what the PR waits on right now and why, its place in any serialization queue with the blocking PR and the shared file, the holding daemon and since when, the next steps, and a rough ETA. Built from fix-dispatch logs, labels, claims and run records, with no extra GitHub calls.
