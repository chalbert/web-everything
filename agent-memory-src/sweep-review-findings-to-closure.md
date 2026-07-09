---
name: sweep-review-findings-to-closure
description: A produced PR carrying an advisory review finding is NOT done until that finding is swept to closure — FIX it (commit + comment) or DISMISS it (comment + correct review label); never leave one dangling. Gate-self review:human clears are human-only via /review.
metadata:
  node_type: memory
  type: feedback
  originSessionId: ea5cca55-f7c8-4d96-b121-675a37e7d208
---

**User directive (2026-07-09):** after a `/workflow` (or `/batch`) run opens PRs and the drain posts
`🤖 advisory` review comments, "PRs opened" is **not** the end state. Every advisory finding on every produced
PR must be **swept to closure**, one of exactly two ways — always:

1. **Fix it** — apply the fix in the item's author lane (a lane CLONE pushing to the PR's `lane/*` ref, so the
   PR updates in place), add a covering test where the finding is a real defect, and post a PR comment naming
   the fix commit + what it addresses. Do this for a **CONFIRMED** finding even one the lane originally
   *dismissed* as out-of-scope: an "observable misclassification **newly introduced** by this diff" is
   in-scope, not scope creep (the #2365 case — the caller switch to `gate.humanRequired` made a pre-existing
   undefined field suddenly load-bearing; fixed by propagating `humanRequired` on the `wait-author` branch).
2. **Dismiss it** — post a PR comment with the concrete reason it won't be fixed, and set the correct
   `review:*` label. A **CONFLICTING/superseded** PR (e.g. a reconcile PR for an item already resolved on
   `main`) is **closed** with a one-line reason comment — that counts as labelled-to-closure.

**The hard invariant:** a **`review:human` gate-self** PR (diff touches the auto-review trust chain —
`scripts/lib/review-escalation.mjs` / `scripts/merge-ai-prs.mjs`) is **never** self-cleared by an agent. You may
FIX it and comment, but the `review:accepted` swap is human-only via `/review <PR>` — an agent clearing a
gate-self edit is the exact conflict-of-interest #2362/#2365 exists to prevent.

**Why:** unaddressed review findings silently rot — a real regression can ride into `main` if nobody acts, and
the drain's advisory pass is pointless if findings aren't swept. The user wants review comments **either fixed
(with a comment) or commented + correctly labelled, always.**

**How to apply:** at the close-out of any run that produced PRs, enumerate each PR's advisory comments +
current `review:*` label and do (1) or (2) before reporting the run done. Transports: `/review` records the
human verdict (the sanctioned place a human clears `review:human`), `/drain` + `/pr` land, `/code-review` is
for a working diff. Relates to [[producer-opens-pr-drain-reviews]] and [[single-session-should-use-a-lane]].
