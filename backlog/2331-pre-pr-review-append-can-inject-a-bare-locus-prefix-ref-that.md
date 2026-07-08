---
kind: story
size: 2
status: resolved
dateOpened: "2026-07-08"
dateStarted: "2026-07-08"
dateResolved: "2026-07-08"
tags: []
---

# Pre-PR review append can inject a bare locus-prefix ref that only CI catches (#2170 residual)

The lane's pre-PR review (#2170) appends a review-notes section to an item body AFTER the author's write-time gate ran, and that append can carry a code-path ref missing the #883 we: locus prefix, which the PostToolUse write-time linter (we:scripts/lint-locus-prefix.mjs) does NOT catch — so it reaches the CI gate red (observed 2026-07-08: #2330/PR #220's appended review-notes section carried an unprefixed reference to we:_site/active-progress.json; the author's local check:standards passed BEFORE the append, and CI caught the leak). #1389/#1574 closed the heredoc/CLI-append bypass but not the review-append path. Fix: re-run the locus-prefix gate on the review-append output (or route the #2170 append through the guarded Edit/Write path) so the producer catches it, not CI.
