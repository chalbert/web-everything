---
bornAs: x5pen0r
kind: story
size: 2
parent: "3318"
status: open
dateOpened: "2026-08-26"
scope:
  - we:scripts/merge-ai-prs.mjs
tags: []
---

# Announce every skipped or degraded review on the PR

22.5% of merged PRs carry no recorded verdict. That is a ruling (#2631), not an omission — but nothing says so on the PR, and a silent absence reads as a clean bill of health. merge-ai-prs already carries a per-PR skip reason; post it, along with juror timeouts and any partial review, in the "Incomplete review — these files were not examined" shape.

## Done when

1. **Executable** — the drain's review-coverage reader and its announcement surface are proven:

   ```sh
   npx vitest run merge-ai-prs -t "#3308" 2>&1 | grep -qE "Tests +[0-9]+ passed"
   ```

   The `grep` is load-bearing, not decoration: `vitest -t <filter>` exits **0** on a tree where the filter
   matches nothing (a selection of zero is a success), so the bare exit code cannot distinguish "the tests
   pass" from "the tests do not exist". Asserting a `Tests N passed` line is what makes it fail before this
   item lands. Observed on `origin/main` (`f4160eaa`): `Tests  400 skipped (400)` ⇒ grep exit **1**.
   Observed after: `Tests  32 passed | 400 skipped (432)` ⇒ grep exit **0**.

   > **Corrected after round-1 review.** This line previously read `Tests  27 passed | 400 skipped (427)`.
   > That was the count before the round-1 correctness fix; the fix added five cases (three driven pass-wide
   > cases plus two gap cases), so the number was stale, not wrong when written. Both figures above were
   > re-measured in the fix lane rather than carried forward.

2. **Not noisy** — a normally-reviewed PR is announced-on byte-identically to before. `reviewCoverageGaps`
   returns an empty list for a PR whose latest verdict seats a mandatory lens against the tree being merged,
   and the drain posts nothing when the list is empty (pinned by the "reports NOTHING for a panel-reviewed
   PR" case).
