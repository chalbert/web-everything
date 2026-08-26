---
bornAs: x8xlz6v
kind: story
size: 2
parent: "3318"
status: open
dateOpened: "2026-08-26"
scope:
  - we:scripts/lib/review-log-claims.mjs
tags: []
---

# Check a quantitative review-log claim against the verdict record before writing it

A `## Review log` entry records this programme's own results under a header promising the next reader need not re-derive them, so a wrong number there is read as settled. Two rounds on PR #1576 bounced on exactly that: a count, a comparison and a lesson, each written from memory, not from the verdict comments they described. Give the author a command that takes a claim's PR numbers and re-derives the counts from `gh pr view <n> --json comments`, so the figure comes from a run, not a recollection.

The three wrong claims, all in one entry: *"cleared in one round each"* (zero of four did — 2 / 2 / 3 / 5); *"found nine wrong figures"* (the record produces four); and *"no test finding at all"* (both pre-split verdicts recorded one, and one of them was the same finding credited to the later round). Each was corrected only where quoted, and the next round found the next one.

Adjacent but not this: #3314 asks whether `claim-accuracy` should be mandatory — a question about who looks. #3307 sweeps an already-corrected claim to its other sites — a question about completeness. This one is about deriving the figure correctly the first time.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
