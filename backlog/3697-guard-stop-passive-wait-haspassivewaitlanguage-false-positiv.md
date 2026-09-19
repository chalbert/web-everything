---
bornAs: xu6v3v5
kind: task
status: open
scope: ["we:scripts/guard-stop-passive-wait.mjs"]
dateOpened: "2026-09-18"
tags: ["prevention-outstanding", "guard-false-positive"]
crossRef:
  url: /pull/2304
  label: "Finding from PR #2304 independent review"
---

# guard-stop-passive-wait hasPassiveWaitLanguage false positives

we:scripts/guard-stop-passive-wait.mjs's `hasPassiveWaitLanguage` function (line ~15) has a narrow hardcoded exclusion list (5 nouns) for legitimate "wait for X" phrasing. Confirmed during independent review of PR #2304 that phrases like "I will wait for confirmation before proceeding," "...for your feedback," "...for the user to decide," and "...for a decision from you" all still match as passive-wait language, meaning a legitimate stop-and-ask-for-guidance message could false-trigger the Stop-hook block if an unrelated backgrounded Bash call also happens to be outstanding. Damage is bounded (the hook's loop-detection caps it at one wasted turn, not permanent stall), but the exclusion list should be broadened or the heuristic made less brittle. Real confirmed finding during PR #2304 review (2026-09-18).

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
