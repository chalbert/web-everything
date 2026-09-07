---
kind: story
size: 3
status: resolved
relatedTo: ["2412", "3373", "3423"]
scope: ["we:.github/workflows/"]
dateOpened: "2026-09-04"
dateResolved: "2026-09-04"
tags: [gate, review, branch-protection]
---

# Required GH check reds while a blocking review:*/redteam:* label is present (closes the manual gh pr merge bypass)

Layer 5 of #2412's defense-in-depth recommendation (a required status check that stays red while review:human/review:pending/review:changes or a missing redteam:accepted on an engine-tier PR is present, so even a manual gh pr merge outside the drain is refused by branch protection) was deliberately NOT built in #2412 itself: it needs a live GitHub branch-protection change (marking a new check required), which is a shared, hard-to-reverse repo setting outside a delivery agent's normal authority, and it may overlap #3373/#3423 (open, branch-protection sole-writer enforcement). Scope: author the required-check workflow under .github/workflows/ that reads a PR's labels and fails while a blocking review hold is present; check for overlap with #3373/#3423 before building; landing 'required' in branch protection itself is an operator action.

## Resolved as a duplicate (found at the #1920 rebase, 2026-09-04)

This item was filed by a lane that forked before `main` had already shipped exactly this: `we:scripts/check-review-gate.mjs`
(+ `we:.github/workflows/review-gate.yml`), landed on `main` the same night by a parallel #2412 lane
(commit `e2f96559`, story #2412's own `resolved` record). `we:scripts/check-review-gate.mjs` reads
`REVIEW_HOLD_LABELS` (`review:pending`/`review:changes`/`review:human`) and reads red while any of them sits
on the PR — including an engine-tier PR parked `review:pending`/`awaitingIndependentValidator` while it awaits
`redteam:accepted` (#2412 Layer 4), since that park uses the ordinary `review:pending` label. No new code
needed. Landing the check as a *required* branch-protection check remains the one genuinely open,
operator-only action this item named — that action is unaffected by this resolution and is still owed, just
not as backlog code work.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
