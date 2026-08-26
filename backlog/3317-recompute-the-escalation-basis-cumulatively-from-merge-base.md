---
bornAs: xi6608w
kind: story
size: 3
parent: "3318"
status: resolved
dateOpened: "2026-08-26"
dateResolved: "2026-08-26"
graduatedTo: none
scope:
  - we:scripts/lib/review-escalation.mjs
  - we:scripts/merge-ai-prs.mjs
  - we:scripts/pr-land.mjs
  - we:scripts/lib/__tests__/review-escalation.test.mjs
tags: []
---

# Recompute the escalation basis cumulatively from merge-base

changedFiles and diffLines may be an own-delta baseRev..head of a stacked lane, and base is self-declared; only humanBasisFiles is forced cumulative today. That makes both the size signal and blast-radius evadable by declaring a stacked base, and by the sanctioned slice-into-two-PRs workflow. Recompute every signal from merge-base(origin/main, head). Deterministic, no model, and a prerequisite for treating size as anything stronger than a signal.

## Not a refusal

This makes the MEASUREMENT honest. It adds no threshold that blocks. Size dials review CAPACITY (reviewers,
rounds, rigor), never review PERMISSION — see `#size-adds-reviewers-never-refuses` (#3320) in
`we:docs/agent/platform-decisions.md`. The `size` token's clearance in `we:scripts/lib/review-policy.contract.json`
stays `agent`, and no `refuse` threshold is added anywhere.

## Scope note

The rubric lives in `we:scripts/lib/review-escalation.mjs`, but it is a PURE function: it can only score the
cumulative basis if a producer hands it one. `humanBasisFiles` (the cumulative FILE set) already arrives;
the cumulative LINE count did not exist on any producer, so the two call sites that derive escalation inputs
(`we:scripts/merge-ai-prs.mjs`, `we:scripts/pr-land.mjs`) publish and thread `cumulativeDiffLines` off the basis
they had already resolved — no extra subprocess. Without that thread the size half of this item is inert.

## Done when

1. **Executable** — `npx vitest run review-escalation -t "#3317" | grep -qE "Tests +[0-9]+ passed"` exits 0.
   The `grep` is load-bearing: a bare `vitest -t` run exits 0 on a tree with no matching tests (an empty
   selection is a success — it reports `Tests N skipped`), so the criterion would be green BEFORE the work.
   `Tests N passed` appears only when the filter actually selected something. On `origin/main` the command
   exits 1 (`Tests 308 skipped`); with this item landed it exits 0 (`Tests 14 passed | 308 skipped`).

## What shipped

Landed on `origin/main` as **PR #1592** (merge commit `89812fd5`, 2026-08-26). Resolved by bookkeeping
reconciliation after the fact — the card was left `open` at land.

- `we:scripts/lib/review-escalation.mjs` — `scoreEscalation` now scores **every** signal over one basis floored
  at the cumulative `mergeBase(origin/main, head)…head` measurement. Files come from a new internal `unionPaths`
  helper (`basisFiles` = the union of the cumulative `humanBasisFiles` and the declared own-delta `changedFiles`,
  first-seen order, non-strings dropped); lines come from `max(diffLines, cumulativeDiffLines)`. Blast-radius,
  gate-self, gate-derivation and statute all read `basisFiles`; `size` reads the maxed line count. The stated
  invariant is that a self-declared `baseRev` may only ever **add** to a signal.
- `diffHunksBasisFiles` was deliberately **not** widened — it stays on `cumulativeFiles`, because it is a pairing
  contract with the hunk text rather than a signal. `basisFiles` is now returned on the verdict so a downstream
  roster recompute can select over the same honest basis.
- Producers — `we:scripts/merge-ai-prs.mjs` (`computeNetDiffSignals` publishes `cumulativeDiffLines` off the
  already-resolved `basis.humanBasis`, so no extra subprocess) and `we:scripts/pr-land.mjs` both thread it in.
- Tests — `we:scripts/lib/__tests__/review-escalation.test.mjs` (+126 lines) and
  `we:scripts/__tests__/merge-ai-prs.test.mjs` (+31 lines).

No threshold was added or relaxed: measurement only, per `#size-adds-reviewers-never-refuses` (#3320), and
`size`'s contract clearance stays `agent`.
