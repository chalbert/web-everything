---
bornAs: xmnvd7x
kind: story
size: 3
parent: "2572"
status: resolved
dateOpened: "2026-08-02"
dateResolved: "2026-08-08"
tags: [conveyor, orchestrator-mechanization, review, enforce-flip]
scope:
  - we:scripts/lib/jury-ledger.mjs
  - we:scripts/lib/disposition-land-seam.mjs
  - we:scripts/lib/disposition-judge.mjs
---

# Ledger-freshness binding: bind the jury ledger to the reviewed head SHA before the review-runner enforce flip

The jury ledger (`we:scripts/lib/jury-ledger.mjs`) carries NO sha/commit field on any event, so `readJuryLog` folds the latest per-juror verdict with no binding to the commit those jurors actually reviewed. A clean ledger written at head A therefore yields WOULD-CLEAR for head B. This is the #2830 review's finding **M4** — filed (not fixed in the shadow slice) per the reviewer's instruction, because it is design work and the shadow runner's fail-closed "no ledger → keep parked" behaviour means it does not block SHADOW. It **must** land before the enforce flip (#2572 part 2).

## The gap

The disposition seams (#2674/#2675) were built to consume a ledger the convergence loop had JUST produced for the current head, so freshness was implicit in the caller and never encoded in the seam contract. The `we:scripts/review-runner.mjs` shadow runner is the first consumer to read the ledger back from durable storage, silently dropping that unstated precondition.

## Failure scenarios (enforce-era)

- A PR reviewed clean at commit A; a push (or a drain rebase) produces commit B with no new review run. The ledger still folds to `unanimous-accept` → clear, for a diff no juror saw.
- The existing staleness guard cannot catch it: `reviewed-sha` (`we:scripts/review-set-label.mjs`) is stamped at WRITE time (head B), so the drain's stale-acceptance refusal is satisfied by a marker certifying an unreviewed tree.
- The same path re-clears a PR bounced to `review:changes` and re-armed to `review:pending`: the pre-bounce accept verdicts still fold clean.

## The fix (proposed)

- Carry the REVIEWED head SHA on the jury-ledger roster/verdict envelope (`we:scripts/lib/jury-ledger.mjs` event shape).
- Make `decideDispositionLabel` (`we:scripts/lib/disposition-land-seam.mjs`) fail-closed-ESCALATE when the ledger's sha does not match the PR's observed head — gated at the DECIDER, so every future consumer inherits the freshness check by construction.
- Lock it with a tripwire in the policy-tier invariant suite.

## Cross-references

- **#2830** — the shadow review runner; the first durable-ledger consumer that surfaced this. Blocks the enforce flip on this item.
- **#2572 / #2838** — the enforce-flip / conveyor-mechanization line this belongs to.
- **#2409** (`reviewed-sha`) — the write-time marker whose gap this closes for the review-time read.

## Acceptance

- Every jury-ledger roster/verdict event carries the reviewed head SHA.
- `decideDispositionLabel` escalates fail-closed when the ledger sha ≠ the PR's observed head (a stale ledger never clears).
- A regression proves: a ledger folded clean at head A yields keep-parked (escalate) once the PR advances to head B with no new review.
- A policy-tier invariant tripwire pins the decider-level freshness check.
