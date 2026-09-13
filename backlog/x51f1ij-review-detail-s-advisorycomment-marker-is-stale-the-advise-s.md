---
kind: story
size: 3
parent: "3383"
status: open
scope: ["we:scripts/review-detail.mjs", "we:scripts/__tests__/review-detail.test.mjs"]
dateOpened: "2026-09-13"
relatedTo: ["3453"]
tags: [operations, review, mechanical-dispatcher]
---

# review-detail's advisoryComment marker is stale — the advise step's real comment never surfaces

we:scripts/review-detail.mjs's assembleReviewDetail computes advisoryComment/advisoryCommentAt by matching a PR comment body against ADVISORY_MARKER = '🤖 advisory AI review' (we:scripts/review-detail.mjs:24). No live poster emits that string: the only advisory-note poster is we:scripts/operations/review-pr.mjs's renderAdvisoryNote (landed by #3453), whose heading is '⚠️ Advisory review (informational only) — {repo}#{pr}' and whose opening line is '**⚠️ THIS IS AN ADVISORY REVIEW, NOT A RECORDED VERDICT.**' — neither string contains the other. Verified 2026-09-13 by grep: 'advisory AI review' occurs nowhere in scripts/ outside we:scripts/review-detail.mjs and its own test fixture (we:scripts/__tests__/review-detail.test.mjs). So advisoryComment/advisoryCommentAt read null for every PR carrying a real advisory note, and have since #3453 landed. we:skills-src/review/SKILL.md explicitly promises the /review ceremony surfaces 'any advisory comment' to the human reviewer (line 95) — that promise is silently unmet. Today's review:awaiting-advisory label work (2026-09-13, commit aa5f1bb28) only signals whether the panel HAS run, not what it found, and does not touch this marker — the gap survives it. Fix: update ADVISORY_MARKER (or generalize the match) to recognize the current renderAdvisoryNote heading/opening line, with a regression test in we:scripts/__tests__/review-detail.test.mjs asserting a real advise-step comment body populates advisoryComment/advisoryCommentAt.

## Done when

1. **Executable** — a unit test in `we:scripts/__tests__/review-detail.test.mjs` feeds `assembleReviewDetail` a
   fixture `comments[]` entry whose body is a REAL `renderAdvisoryNote` output (starting with the heading
   `⚠️ Advisory review (informational only) — {repo}#{pr}` or the opening line `**⚠️ THIS IS AN ADVISORY
   REVIEW, NOT A RECORDED VERDICT.**` — whichever `we:scripts/operations/review-pr.mjs` actually emits at
   build time) and asserts `advisoryComment` is non-null and `advisoryCommentAt` is populated. This fails
   today (both read `null`) and must pass after the fix.
2. The existing fixture/test built against the old `'🤖 advisory AI review'` marker is either updated to the
   real marker or kept as an explicit "legacy marker, still tolerated" case — whichever the builder decides,
   stated in the PR — so the old test does not silently start asserting a fiction.
3. `npm run check:standards` and the full `we:scripts/__tests__/review-detail.test.mjs` suite stay green.
