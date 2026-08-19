---
bornAs: x8952dw
kind: task
status: open
dateOpened: "2026-08-19"
tags: []
---

# the git-hook --all scan resets quote state at every physical line

`we:scripts/check-standards-rules.mjs`'s `shellCodeOf` decides where a line's code ends by tracking quotes, but starts each physical line with no quote open. A single-quoted string spanning two lines whose continuation begins with a hash therefore reads as a whole-line comment, so a real deploy-CLI invocation after the closing quote on that line is never scanned at all. Verified live against bash by the review-pr juror on PR #1488 round 7: the invocation runs, the scan reports nothing. Carry the open-quote state across lines, or refuse to treat a line as a comment while a string is open.

## Why it hides rather than merely misses

Every other gap this scan has had was a boundary it failed to SEE. This one is different in kind: the scan
decides the whole line is a comment and never tokenizes it at all, so a genuine invocation sitting after the
closing quote is not examined. A gate that stops looking is worse than one that looks and does not recognise,
because the second at least degrades toward the escape hatch.

It is a RESIDUAL, not a regression. The quote tracking in `shellCodeOf` exists so that `echo "a#b"` is not
misread as opening a comment, and it does that correctly WITHIN a line. Carrying the state BETWEEN lines was
never implemented, and no earlier round of PR #1488 reached it.

## Why it is filed rather than fixed

PR #1488 spent seven review rounds on this one detector, each closing a real shell form the juror had verified
against bash. The gate is worth having and the rounds were not wasted, but seven is past the point where
another turn on the same file is the best use of a review. The fix here is small and separable, and the card
carries the exact verified case, so nothing is lost by landing the six closed forms and taking this one on its
own.

## Two ways to close it

- **Carry the state.** Have `shellCodeOf` accept an incoming open-quote and return the outgoing one, and have
  `logicalLines` thread it. Exact, and it makes the comment decision correct for every multi-line string.
- **Refuse to call it a comment while a string is open.** Cheaper and strictly safe: if the previous line ended
  inside a quote, scan the whole next line as code. It over-reports where the string genuinely continues, which
  is the direction this scan already declares for itself.

The second is enough if the first is deferred, because the failure being closed is "stopped looking", not
"looked and mis-tokenized".

## Done when

1. **Executable** — a test in `we:scripts/__tests__/check-standards-rules.test.mjs` feeding
   `we:scripts/check-standards-rules.mjs`'s `findGitHookAllFlags` a two-physical-line single-quoted assignment
   whose second line starts with a hash and then invokes the deploy CLI with the flag. It returns nothing today
   and must report that line.
2. A line that is genuinely a comment is still treated as one, so the fix does not trade this miss for noise on
   every hook in the tree.
3. `we:.githooks/` still passes the gate unchanged — the shipped hooks are the standing regression.
