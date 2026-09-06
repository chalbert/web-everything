---
kind: story
size: 5
status: open
dateOpened: "2026-09-06"
tags: []
---

# review-pr cannot judge a Frontier UI or Plateau PR, though the label swap can stamp one

`we:scripts/operations/review-pr-io.mjs` refuses a cross-repo target outright (#3137 — correctly; it used to
degrade to an empty diff), because `review-pr` reads its diff from local git rooted at the checkout it runs
in. The runner lives only in web-everything, and frontierui has no operations runner at all. So no FUI or
Plateau PR can be **judged** through the declared operation — while `we:scripts/review-set-label.mjs` takes
`--repo=<owner/name>` and will happily **stamp** a verdict on one. The machinery can record a verdict it has
no way to form.

## Done when

1. **Executable** — `we:scripts/operations/run.mjs review-pr --pr=<n> --repo=chalbert/frontierui` produces a judged verdict rather
   than the `review-pr-io` cross-repo refusal, reproduced against a real parked FUI PR (chalbert/frontierui#43
   is the live case). Red before, green after.
2. The diff basis is the FUI checkout's real diff — never an empty one. The #3137 refusal exists because a
   silent empty-diff degrade is worse than a refusal, and that must stay true: if the FUI checkout cannot be
   resolved, it still refuses.
3. Either arm is acceptable, and choosing between them is the design call this item carries:
   - a lane-cwd override for the `read` step, mirroring the `JUDGE_LANE_CWD` the judge steps already accept
     (the refusal message itself names this), or
   - the operations runner made reachable from a sibling checkout.

## Why it matters more than a missing convenience

The gate is asymmetric in the dangerous direction. `we:scripts/review-set-label.mjs` takes
`--repo=<owner/name>` and will stamp `review:accepted` on a FUI PR today; `review-pr` cannot form the verdict
being stamped. So the only reachable path to clearing a parked FUI PR is one that records a judgement no
tooling produced — which is exactly the `no-recorded-review` shape the drain stamps and `#xzw59we`/`#x45zcv4`
were filed about.

The impl half of every cross-repo couple lives in FUI, so this is not an edge: it is the review path for the
most-reviewed class of PR in the constellation.

## Observed

chalbert/frontierui#43 has sat green, clean and `review:pending` since it was parked for `blast-radius` +
`size`. Running the declared operation against it returns:

> refusing to review chalbert/frontierui#43 — this checkout is chalbert/web-everything … a cross-repo target
> cannot be resolved here

The refusal names its own precondition — *"if cross-repo review-pr support becomes a real requirement"*. It is
one.
