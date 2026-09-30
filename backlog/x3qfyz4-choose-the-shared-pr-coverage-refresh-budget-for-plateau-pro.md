---
kind: decision
status: resolved
dateOpened: "2026-09-30"
dateResolved: "2026-09-30"
tags: []
---

# Choose the shared PR coverage refresh budget for Plateau progress

Choose the shared PR completeness budget and the read-only source of standing rules for Plateau progress. Design: we:docs/agent/plateau-progress-view.md.

## Fork 1: shared PR completeness and refresh budget

A: read only local PR snapshots/events. No added API spend; coverage remains explicitly partial if producers miss operator-authored PRs or pages.

B (recommended): reuse one shared PR producer, all authors across the three repos, with a single-flight five-minute reconciliation ceiling and a proposed 36 REST requests/hour allowance. Pagination consumes the same allowance; existing lower limits and write reserves win. The publisher and browser never call GitHub. Exhaustion means partial data, not a second identity or hidden extra calls.

The real tradeoff is completeness latency versus scarce GitHub budget. This is not a new transport or repo-placement decision. The current snapshot shape does not certify all-author pagination or merged-event history. First inspect those producer guarantees before ratification; the recommendation is not an approval.

## Fork 2: authoritative read-only rules source


A. Keep the external operator plan, with explicit section selection, source dates and conflict warnings. Cheapest display adapter; conflicts and divergence from daemon config persist.

B. Adopt a structured versioned Plateau policy document with effective dates and supersession, importing reviewed rules once. Recommended eventual target: traceable priorities and rules without duplicated prose. WE defines its shape; Plateau owns storage and the read-only projection. This decision does not make the document control daemons.

## Evidence and scope

The external plan has newer September 29 caps alongside older Standing rules and Overnight sections. The design at we:docs/agent/plateau-progress-view.md documents the conflicting snapshots and the intended/observed distinction. Latest prose must not silently override effective daemon policy. The overview uses A as a reversible adapter with conflicts visible, so this fork does not block progress-first delivery.


## Done when

1. Operator records A or B for each fork: shared refresh cadence/budget and incomplete-coverage behavior; then policy source ownership, effective dates and migration requirements.
2. Update we:docs/agent/plateau-progress-view.md with the ruling and preserve source/coverage timestamps for both choices.
3. Codify any reusable rule in its topical contract guidance when ratified; keep this card as decision lineage.

## Follow-ups

Unqueued until the operator rules. Validate missing repo, exhausted budget, pagination interruption and simultaneous refresh clients in the dependent story. No live GitHub calls were made to prepare this proposal.

## Operator ruling (2026-09-30 ~11:50 AM ET)

- **Fork 1, coverage: B.** One shared, budget-limited REST refresh of all three repos (all authors), at most every 5 minutes, about 36 REST requests per hour including pagination. Existing lower limits and write reserves win. REST only: it must not spend the GraphQL budget.
- **Fork 2, policy source: A now, B as the target.** The first slice shows the operator-designated sections of the plan file read-only, with dates and conflict warnings, and no automatic precedence. A later slice moves the rules into a structured, versioned Plateau policy document (each rule with an effective time and what it supersedes), then retires the plan file as the source.
