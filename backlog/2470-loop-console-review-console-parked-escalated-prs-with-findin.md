---
bornAs: xq0pzzo
kind: story
size: 5
parent: "2474"
status: resolved
dateOpened: "2026-07-12"
dateStarted: "2026-07-13"
dateResolved: "2026-07-13"
tags: []
---

# Loop console: review console — parked/escalated PRs with findings, swap review labels

Surface the review flow: parked/escalated PRs with their escalation reason + panel findings; swap review labels (accept / changes / human) from the UI. The /review flow as a browser surface.

## Resolution (2026-07-13)

Shipped in two increments, both merged:

- **Increment 1 — read-only review detail.** WE PR #462 ([we:scripts/review-detail.mjs](../scripts/review-detail.mjs) — assembles a parked PR's review context as JSON, single-sourced in WE) + plateau PR #23 (the `plateau:tools/dev-panel/drain-daemon.html` "Review ▸" expand rendering the escalation reason, drain advisory comment, disposition, and diff stat inline).
- **Increment 2 — guarded label-swap.** WE PR #463 ([we:scripts/review-set-label.mjs](../scripts/review-set-label.mjs) — pure `decideSetLabel` that REFUSES accepting a `review:human` PR, so INVARIANT 2 is enforced in code) + plateau PR #24 (Accept / Request-changes controls in the review expand; Accept is disabled on `review:human` rows).

The parked/escalated review flow is now operable from the plateau dev-panel drain-daemon surface: a parked PR expands to its review context and the operator accepts or bounces from the browser. INVARIANT 2 holds via triple defense-in-depth (UI gate → server validation → WE CLI refusal). Both WE PRs were cleared by a fresh adversarial review panel (engine-tier, `review:pending`) and landed by the resident daemon; the plateau PRs were landed manually (the daemon drains WE only).
