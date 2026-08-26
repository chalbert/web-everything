---
bornAs: xdrbnkb
kind: decision
parent: "3318"
status: resolved
dateOpened: "2026-08-26"
dateResolved: "2026-08-26"
codifiedIn: "docs/agent/platform-decisions.md#every-pr-gets-a-look-advisory-floor"
preparedDate: "2026-08-26"
tags: []
---

# Should a sampling floor be restored over auto-landed PRs

**Ruled 2026-08-26: no sampler — every no-reason PR gets a cheap advisory sanity check instead.** Convened as
a go/no-go on restoring random sampling, the ruling took **neither** branch: the answer is full coverage at
much lower depth, non-blocking. Codified as `#every-pr-gets-a-look-advisory-floor` in
`we:docs/agent/platform-decisions.md`. Built by `#3329` (the `observed` verdict) then `#3330` (the pass).

## What was proposed

[#2631] dropped `we:scripts/pr-land.mjs`'s random ~1-in-10 sampler on the operator finding that random
sampling had no value — the removal is recorded as a comment at `we:scripts/lib/review-escalation.mjs:588`,
where the floor used to be scored. That leaves **29 of 129 merges (22.5%)** reaching no independent reviewer
at all. The
prepared recommendation was **not yet** — restore nothing until [#3315] can state an adjudicated precision
figure, on the reasoning that restoring the floor now re-runs the same experiment with the same missing
measurement.

## Why neither branch was taken

1. **"Not yet" is circular.** #3313 was to wait on #3315, and #3315 needs adjudicable independent verdicts
   over exactly this population — which only a sampler produces. The prepared card named that trigger as
   observable and flagged the *park-by-attrition* risk itself. The loop is the risk, not a side effect of it.

2. **The sampler was never dropped for cost — it was dropped for latency.** #2631 sits under [#2606], the
   throughput-and-latency program. Its complaint was that a park *stops the merge*: #690, #694 and #695 sat
   still awaiting a review that found nothing. That diagnosis is correct and survives. But it indicts
   **blocking**, not **looking** — and the two were fused only because, today, `REVIEW_HOLD_LABELS` makes
   every recorded review a hold. Unfuse them and the objection evaporates.

3. **Randomness was the wrong axis to economize on.** A sampler buys coverage with dice: it is
   non-deterministic, unauditable per-PR ("did this one get looked at?" has no answer), and it yields a
   trickle of ledger rows where a full pass yields the whole population. The cheap axis is **depth**, not
   **coverage**. One tool-free diff-read across all 29 costs roughly $12.50 per 129 merges against a full
   lens's $0.43/PR — an order more coverage for an order less depth, and no dice.

## What replaces it

**Every no-reason PR gets one tool-free, diff-only sanity juror; the verdict is recorded and never bears on
the merge.** The bound is deliberate and is the operator's ratifying amendment: *this replaces no review, so
its bar is "catch the obvious", not "converge".* A pass scoped to what a full reviewer would find is a full
reviewer, and that is a cost-and-latency argument this ruling did not make.

Two consequences worth stating, because both were found rather than assumed:

- **It needs a verdict the ledger does not have.** `VERDICTS` is closed and total — every value clears or
  holds. `accepted` would be a lie *and* would inflate the acceptance count, the exact miscount `RESTAMPED`
  exists to prevent; `changes` holds. Hence `observed` (`#3329`), which must be excluded from
  `foldVerdictLedger`'s disposition entirely, not merely marked non-clearing.
- **It is not blocked on [#3158].** `judgePanel` runs every juror `--tools ''`, which #3158 files as a real
  cost for a deep reviewer. For a diff-only sanity read it is the specification. Scaling down removed the
  blocker instead of inheriting it.

## The cost this accepts

A pass that can never block finds things **after** the merge, so the response is fixing forward rather than
preventing. That is acceptable *here* because of which PRs these are — small, single-repo, no sensitive paths
— and would not be acceptable for any escalating class. It is also why a finding must file a follow-up item:
a review nobody must act on rots into noise.

## What this does not settle

- **[#3315] is still owed**, and still blocked on the verdict ledger (#3007 / #3255). This ruling stops #3313
  waiting on it, and feeds it the whole population instead of a sampled trickle — it does not build it. The
  prepared card's trigger (*re-open when #3315 can state an adjudicated precision figure*) is **discharged**,
  not deferred: the floor no longer waits on that measurement, and now produces its inputs.
- **Whether the sanity findings are any good.** Per-category effective-false-positive measurement is #3315's
  job. If the pass's findings prove worthless, the honest response is to retire it under #3318's standing
  auto-disable contract, not to deepen it into the reviewer this ruling declined.
- **The depth table above the floor.** How much a *no-reason* PR earns is now fixed at the floor; how care
  scales above it is unchanged and out of scope.

## Done when

1. **Executable** — `npm run check:standards` passes with this item `status: resolved` and `codifiedIn`
   pointing at `#every-pr-gets-a-look-advisory-floor`, and no random or modulo sampler exists in
   `we:scripts/pr-land.mjs` (the #2631 removal stands — this ruling does not restore it).
