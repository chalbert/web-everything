---
kind: story
size: 3
status: resolved
dateOpened: "2026-07-10"
dateStarted: "2026-07-27"
dateResolved: "2026-07-28"
tags: [gate, review, drain, gate-self]
scope:
  - we:scripts/lib/review-escalation.mjs
  - we:scripts/merge-ai-prs.mjs
  - we:scripts/review-set-label.mjs
  - we:scripts/__tests__/review-set-label.test.mjs
  - we:scripts/lib/review-baseline-state.mjs
  - we:scripts/lib/__tests__/review-escalation.test.mjs
  - we:scripts/__tests__/review-escalation.test.mjs
  - we:scripts/__tests__/merge-ai-prs.test.mjs
  - we:scripts/lib/__tests__/review-baseline-state.test.mjs
  - we:scripts/lib/__tests__/gate-invariants.test.mjs
---

# Gate check: a PR's reviewed commit-set must match its head before review:accepted is honored

Close the ordering hole exposed while landing the gate-hardening work: a commit can ride into a PR's tree around review time and be honored under review:accepted without having been the tree the reviewer actually looked at (PR #368 carried a second, unrelated commit at accept time; the accept comment named only the first). Add a deterministic gate to the drain/review path (we:scripts/lib/review-escalation.mjs / we:scripts/merge-ai-prs.mjs): before honoring review:accepted (or landing), diff the PR's currently-reviewed/accepted commit-set against its live head; if the head advanced past what the acceptance covered, refuse to auto-land and re-park for a fresh look. Belongs under the gate-hardening epic (parent edge to be added once that epic lands from PR #368). Ships with an invariant tripwire like the rest of the gate.

## Progress

- `we:scripts/lib/review-escalation.mjs` (pure): added `buildReviewedShaMarker` / `parseReviewedSha` (the machine-readable `reviewed-sha` marker), `acceptanceCoversHead` (prefix-tolerant SHA compare, fails OPEN on a missing SHA), and gated `decideReviewGate`'s accepted→merge branch behind it — a head that advanced past the reviewed commit re-parks (`staleAcceptance`; `review:pending`, or `review:human` when gate-self) instead of merging.
- `we:scripts/review-set-label.mjs`: on an `accepted` verdict the shared CLI harness now reads `headRefOid` alongside labels and stamps the reviewed-SHA marker into the durable accept comment (the tree the reviewer looked at).
- `we:scripts/merge-ai-prs.mjs` (drain): for a `review:accepted` PR, lazily reads the reviewed SHA (from comments) plus the live head and feeds both to `decideReviewGate`; a stale-acceptance verdict drops the now-stale `review:accepted`, re-parks, and stamps the reason. `applyEscalationRelief` refuses to waive a stale-acceptance park.
- Tests: pure helpers plus staleness cases in `we:scripts/lib/__tests__/review-escalation.test.mjs`, a new cross-product INVARIANT 9 tripwire in `we:scripts/lib/__tests__/gate-invariants.test.mjs` (stale accept never auto-merges; a fresh accept always merges), and the relief-valve guard in `we:scripts/__tests__/merge-ai-prs.test.mjs`.
- Honest residuals (documented, matching the sibling gates' fail-open posture): (1) the bare `/merge` orphan-sweep path (`hasUnclearedReviewLabel`) still clears on the `review:accepted` label alone with no SHA context; the primary label-scoped drain path is gated. (2) The reviewed-SHA marker rides an ordinary PR comment, so an actor able to comment could forge coverage; a hardened home would bind it to the label-applying actor or an immutable check-run. Both accepted under the single-tenant trust model.
