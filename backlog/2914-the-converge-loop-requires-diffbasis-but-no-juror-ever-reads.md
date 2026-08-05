---
bornAs: x8a6jbo
kind: story
size: 3
status: open
dateOpened: "2026-08-05"
tags: [drain, review, converge-loop, gate]
---

# The converge loop requires diffBasis but no juror ever reads it

PR #1039 (item #2901) made `diffBasis` a required field of FETCH_SCHEMA in we:scripts/workflows/review-parked-prs.mjs and taught the fetch prompt to copy it through verbatim — but nothing reads it. The loop destructures only fetched.diff / fetched.title / fetched.escalationReason, never fetched.diffBasis, and no other module mentions the field. So a fetch that silently degrades from the net two-tree diff to three-dot `gh pr diff` still puts an inflated diff in front of a juror with no signal, and the phantom scope-creep finding #2901 set out to kill stays reachable — now intermittent instead of constant.

## The evidence

Found in the human review of **WE PR #1039** (`/review`, round 2), and confirmed by an independent red-team
pass before filing.

- `we:scripts/workflows/review-parked-prs.mjs:237` — `FETCH_SCHEMA.required` now includes `diffBasis`.
- `we:scripts/workflows/review-parked-prs.mjs:477` — the fetch prompt instructs "Copy its `diffBasis` through
  VERBATIM — do not infer it, do not default it."
- `we:scripts/workflows/review-parked-prs.mjs:908` — the loop reads `fetched.diff`; `:909` `fetched.title`;
  `:910` `fetched.escalationReason`; the round-refresh sites at `:979` and `:1002` re-read `fetched.diff` only.
  **`fetched.diffBasis` is never read**, here or anywhere else — a repo-wide grep for `.diffBasis` outside the
  tests returns no consumer.

So the field is produced, validated as required, and propagated through an agent echo — and then dropped. A
schema `required` on a value nobody consumes buys nothing: it fails the fetch step when the field is missing,
and changes nothing when it is present and says `three-dot`.

Worth recording for whoever picks this up: the commit that introduced it (`58cf8456`) has the message
"Address the #1039 review — bind the diff to the OID, and give diffBasis a consumer". The first half is real
and verified; the second half did not happen. Do not take the commit message as evidence the work is done.

## Why it matters

`#2901` exists because a juror on **PR #1018** flagged an "unrelated #2457 re-scope" that the PR did not
contain — it was reading `gh pr diff`'s three-dot output, which lists sibling-lane files that already landed
on `main` as though this PR added them. #1039 fixed the *fetch* so the loop gets the net diff.

But five conditions still silently degrade net → three-dot (a foreign clone without the head ref, a failed or
incomplete fetch, a missing/stale `headRefOid`, a diff failure, a gh/git file-list disagreement). Before
#1039 the loop always got the three-dot diff — degraded, but **constant and known**. Now it usually gets the
net diff and sometimes does not, with nothing downstream able to tell the difference. Round 1 net, round 2
three-dot after a transient hiccup, and the round-2 juror files a phantom finding. That is strictly harder to
diagnose than the constant failure it replaced.

## The fix — two halves, different review classes

Note the split, because it decides how this lands:

1. **Tell the juror** — thread the basis into the panel mandate so a reviewer holding a three-dot diff is told
   so, and told not to report scope creep from it. `buildPanelMandate` is at
   `we:scripts/lib/review-core.mjs:759`, and `isGateSelfPath` returns **true** for that file (policy tier), so
   this half **requires the human review path** — an agent may not self-clear it.
2. **Make the verdict act on it** — refuse a `three-dot` round outright, or force `needs-human`, rather than
   letting a degraded basis produce a normal `land`. The verdict reducers (`deriveVerdict`,
   `isFindingOutstanding`, `deriveNegotiationOutcome`) are defined in `we:scripts/lib/jury-core.mjs:119-265`
   and only re-exported by `we:scripts/lib/review-core.mjs`; `isGateSelfPath` returns **false** for the
   jury-core file, so this half is agent-reviewable.

The disclosure half alone is NOT sufficient: it is the same defect one layer on — a label carried past a
reader that does not act on it. Prefer (2), or both. Whichever is chosen, the acceptance test is a consumer
that changes behaviour, not a field that is merely present.

## Definition of done

- A degraded (`three-dot`) fetch produces an observably different loop outcome than a `net` one — a refused
  round, a forced escalation, or at minimum a mandate the juror is bound by.
- A test that fails if `diffBasis` regains zero readers (the defect this item exists for is exactly a field
  with a producer and no consumer — see the memory rule "verify a mechanism has a consumer").
