---
kind: task
parent: "3029"
status: open
dateOpened: "2026-08-21"
tags: []
---

# a juror verdict summary can carry stray tool-call markup into the PR comment

PR #1521's round-2 verdict summary ended with a literal `</parameter>` and `</invoke>` — closing tags from the juror's own tool-call syntax, leaked into the structured `summary` string. `we:scripts/operations/record-verdict.mjs` carries that field verbatim into the durable PR comment, so the write-up a human reads would have shown framing markup as if it were prose. Cosmetic in effect, but it means the juror's structured output is not being validated for stray control syntax before it becomes the review of record. Strip or refuse it at the boundary that shapes the verdict, and pin it with a test.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
