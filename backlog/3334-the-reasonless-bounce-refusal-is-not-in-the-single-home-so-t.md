---
bornAs: x42si3c
kind: story
size: 2
parent: "3318"
status: resolved
dateOpened: "2026-08-26"
dateResolved: "2026-08-27"
scope:
  - we:scripts/review-set-label.mjs
tags: []
---

# The reasonless-bounce refusal is not in the single home, so two routes bypass it

The guard refusing a changes verdict with no findings and no reason lives in review-pr's record step alone. record-verdict and review-set-label both write labels without it, and a real bounce got through on PR 1593.

## Observed, on a real PR

PR **#1593** carries a recorded verdict reading:

> **Verdict:** ✅ pass — no blocking findings … **Findings (0)** … _No findings._
>
> **Decision:** `changes` — recorded by operator.

No reason block appears anywhere in the comment. `renderVerdictWriteUp` publishes the operator's reason whenever
it is non-empty, so its absence means none was given. A `changes` with a passing verdict, zero findings and no
stated reason is exactly what the #1572 guard exists to refuse — and it landed anyway.

## Why it got through

The refusal is implemented in **one caller**:

`we:scripts/operations/review-pr.mjs`, in the `record` step —
*"refusing to record `changes` … with no stated reason"*.

Two other sanctioned paths write the label and carry **no such check**:

- `we:scripts/operations/record-verdict.mjs` — the transport used on any host that cannot authenticate to
  GitHub, which on a cloud runner is every host.
- `we:scripts/review-set-label.mjs` — the direct CLI.

## The architectural point

#2644 established `we:scripts/review-set-label.mjs` as **the single home** for the label swap, and
`decideSetLabel`'s pure core is where INVARIANT 2 already lives (`accepted` is refused on a `review:human` PR).
The reasonless-bounce guard was put in a **caller** instead of in that home, so it protects the one route that
happens to run it.

That is the whole failure. A rule enforced in one caller of a single-home function is not enforced; it is
merely *usually* encountered. The fix is to move the check down beside INVARIANT 2, where every route passes
through it, and leave the caller's version as a redundant early error at most.

This needs the decision inputs to reach the core: it must know the **juror finding count** and the **stated
reason**, neither of which `decideSetLabel` takes today. That is the actual work — the condition itself is
three lines.

## Why it matters beyond tidiness

The standing goal is to **avoid bouncing to a human unless a human is genuinely needed**. A bounce carrying no
findings and no reason is the worst case: it costs a full round, and the author cannot act on it because
nothing was said. The guard was built precisely to make that unpublishable, and the route most likely to be
used on a headless host is the one without it.

## Done when

1. **Executable** — a test asserting `decideSetLabel` refuses `changes` when the verdict has zero findings and
   no reason, and **allows** it when either a finding or a reason is present. Both directions; a guard that
   also blocks legitimate bounces is worse than the hole.
2. The same refusal is reachable through `record-verdict` and the direct CLI, asserted per route rather than
   assumed from the shared core.
3. `npm run check:standards` — 0 errors.
