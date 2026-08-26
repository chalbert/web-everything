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
   Observed after: `Tests  33 passed | 400 skipped (433)` ⇒ grep exit **0**.

   > **Corrected twice.** This line first read `Tests  27 passed | 400 skipped (427)`, then
   > `Tests  32 passed | 400 skipped (432)`. Neither was wrong when written — the round-1 correctness fix
   > added five cases, and the noise measurement below then replaced six condition cases with seven
   > exclusion cases. Every figure above was re-measured rather than carried forward.

2. **Not noisy — measured, not asserted.** Replayed over the 60 most recently merged PRs in this repo, the
   shipped `reviewCoverageGaps` posts a notice on **8 (13.3%)**, all of them `no-recorded-review`. The
   pre-measurement version of the same function posts on **59 of the same 60 (98.3%)**, which is the failure
   this criterion exists to catch: an announcement on nearly every PR trains readers to skip it, recreating
   the silence it was built to end. Four conditions were cut on that measurement, each with its rate pinned
   in a test of its own so a later change that re-adds one has to argue with the number:

   | cut condition | fired on | why it is not a departure |
   | --- | --- | --- |
   | self-declared single-lens run | 21/60 (35%) | the record already says so in its own body — and #3319 retired the sentence from the renderer, so a detector reads legacy records only |
   | re-stamped acceptance | 31/60 (52%) | the drain's own content-preserving rebase path, granted only after the reviewed-contribution markers clear it |
   | moved head sha ("stale basis") | 12/60 (20%), all false | #2409 already refuses to merge a PR whose acceptance does not cover its head, so a sha difference reaching the merge cascade is proof that gate ran |
   | `clear-human` ceremony clearance | 1/60 | its own comment states exactly what it proves and what it does not (#2895) |

   Both terminal record shapes (re-stamp, `clear-human`) stop the analysis rather than falling through to
   the basis checks — reading either as an accept would manufacture `unstated-basis` on 53% of merges, the
   same noise by a different door.
