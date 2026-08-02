---
bornAs: xjkje69
kind: story
size: 3
status: open
dateOpened: "2026-08-02"
scope:
  - we:scripts/merge-ai-prs.mjs
  - we:scripts/__tests__/merge-ai-prs.test.mjs
tags: [drain, merge-ordering, review-integrity, degraded-read]
---

# Gate the drain's ordering context on a degraded open-PR read (an empty or truncated listing must never be trusted)

#2880 made the label-blind open-PR listing the SOLE cross-item merge-ordering
source, but a degraded read of that listing is still trusted: a failed listing
yields an empty set that is classified HEALTHY, the truncation warning is
silenced under `--json`, and `--no-reconcile-labels` reopens the pre-#2880 bug.

Filed from the `/review` red-team of PR #999 (item #2880), as the follow-up its
accept comment promised. That accept scoped the residual to *truncation* and
judged it low-exposure "because the warning makes it visible". Red-teaming the
accept showed the premise was wrong: on the automated path the warning is not
visible at all, and the same unread `truncated` flag sits beside a failure mode
that is both likelier than truncation and actively misclassified as healthy.

## The invariant #2880 established, and where it leaks

Since #2880 the drain's cross-item merge ORDER derives from
`collectOpenPrContext`'s label-blind open-PR item set
([we:scripts/merge-ai-prs.mjs](scripts/merge-ai-prs.mjs) —
`orderExtraOpenItems`), not from the `--label ready-to-merge`-scoped candidate
list. The safety argument is that a SUPERSET can only ADD a defer, never drop
one. That argument holds only while the open set is COMPLETE. Every leak below
makes it a SUBSET, and a subset drops defers — a dependent whose blocker is
missing reads the edge as "landed" and merges EARLY, which is exactly the hazard
#2880 exists to prevent.

### F3a — a FAILED listing is classified as a healthy read (the sharpest leak)

`collectOpenPrContext`'s per-repo listing swallows every error:

```js
catch { return [repo, []]; }
```

An empty array contributes NO items to `openItems`. `isDegradedOpenPrListing(0)`
returns `false`, so a total loss is classified as a COMPLETE read — the shipped
test asserts exactly that (`expect(isDegradedOpenPrListing(0, LIMIT)).toBe(false)`).

Meanwhile the SIBLING candidate listing treats the same `gh` error as a
bad-env HARD FAIL (`fail('gh-error', …, 3)`). So the two listings have opposite
failure postures over the same call. A transient `gh` fault (rate limit, network
blip, expired auth) that hits the ordering listing but not the candidate listing
produces a silently EMPTY ordering context: every cross-repo `blockedBy` edge
resolves as landed and dependents land out of order — with no warning, no
`--limit` precondition, and no test that would notice.

This is strictly worse than the truncation case #2880 mitigated: truncation
loses the tail, a failure loses everything, and only the tail case is flagged.

### F3b — the truncation warning is silenced exactly where the drain is automated

The `⚠️ DEGRADED open-PR listing` warning is gated `if (!AS_JSON)`, and the
`truncated` flag `collectOpenPrContext` returns is read by NOBODY — it never
reaches the pass's `result` object either. The `/drain` skill consumes that
pass's `--json` (`{merged, failed, deferred, parked, skipped}`).

So on the primary automated path a degraded read is 100% silent. The mitigation
only works for a human watching stderr, which is not how the drain runs.

### F3c — `--no-reconcile-labels` reopens the pre-#2880 bug

`RECONCILE = label && !flags['no-reconcile-labels']`. With
`--label=ready-to-merge --no-reconcile-labels`, `openPrContext` is the empty
stub, so `orderExtraOpenItems` is an empty Set and ordering derives SOLELY from
the label-scoped candidate list — precisely the pre-#2880 state, and an
early-land footgun once #984/#2832 strips `ready-to-merge` from held PRs.

The shipped comment enumerates only the benign case ("the label-less orphan
sweep… the candidate list already IS the full open set"), which is FALSE for
this flag combination. Every landing test in
[we:scripts/__tests__/gate-entrypoint-integration.test.mjs](scripts/__tests__/gate-entrypoint-integration.test.mjs)
runs with `--no-reconcile-labels`, so the integration tests exercise the
un-decoupled path.

### F3d — the sibling cap was left behind (minor)

#2880 raised the ORDERING listing to `OPEN_PR_LIST_LIMIT = 500` but left the
CANDIDATE listing at `--limit 100`. Low severity on its own — a truncated
candidate list DELAYS a land rather than reordering one — but the two caps
should not silently disagree now that one of them is a merge-safety input.

## The shape of the fix

The through-line: **an incomplete open set is the UNSAFE direction, so a
degraded read must fail CLOSED, not fall through as "nothing is open".**

- **Classify a failed listing as degraded, not empty.** Distinguish "this repo
  genuinely has no open PRs" from "we could not read this repo". Only the first
  may contribute an empty set to the ordering context.
- **Gate the ordering decision on the flag.** With a degraded read, either
  hard-fail like the candidate listing does, or fall back to the pre-#2880
  candidate-scoped ordering and refuse the early-land decision for the affected
  items — never proceed silently on a partial set.
- **Surface it in the machine-readable result**, not only on stderr, so the
  `--json` consumers (the `/drain` skill, the resident daemon) can see a
  degraded pass.
- **Close the `--no-reconcile-labels` hole**: with a `--label` scope, either
  refuse the combination or force the open-set collection regardless, so the
  ordering context is never silently empty.
- **Reconcile the two listing caps** and their failure postures.

## Acceptance

- **AC1 — a failed listing is degraded, not healthy.** A per-repo listing that
  threw is classified degraded; `isDegradedOpenPrListing` (or its successor) no
  longer reports a zero-length FAILED read as complete. A genuinely empty repo
  stays healthy — the two cases are distinguishable.
- **AC2 — a degraded ordering context never yields an early land.** With the
  ordering listing degraded and a dependent whose blocker is only visible
  through it, the dependent is NOT ready. Mirror: with a healthy read and the
  blocker genuinely landed, it IS ready (the defer comes from the degrade, not
  from blanket pessimism).
- **AC3 — the degrade is machine-visible.** The pass's `--json` result carries
  the degraded-read signal; it is not stderr-only, and not gated on `!AS_JSON`.
- **AC4 — `--label` + `--no-reconcile-labels` cannot silently empty the
  ordering context.** Either the combination is refused, or the open set is
  collected anyway; a test pins whichever is chosen.
- **AC5 — the caps agree.** The candidate and ordering listings use one
  single-sourced cap with one documented failure posture, or the divergence is
  stated with its reason.

## Loci

- [we:scripts/merge-ai-prs.mjs](scripts/merge-ai-prs.mjs) — `collectOpenPrContext`
  (the swallowing `catch`, the `--json`-gated warning, the unread `truncated`)
- [we:scripts/merge-ai-prs.mjs](scripts/merge-ai-prs.mjs) — `isDegradedOpenPrListing`
  / `OPEN_PR_LIST_LIMIT` (the classifier that calls a failed read complete)
- [we:scripts/merge-ai-prs.mjs](scripts/merge-ai-prs.mjs) — `RECONCILE` /
  `orderExtraOpenItems` (the `--no-reconcile-labels` hole)
- [we:scripts/__tests__/merge-ai-prs.test.mjs](scripts/__tests__/merge-ai-prs.test.mjs)
  — the `#999/2880 F3` describe block (the assertion pinning empty as healthy)
