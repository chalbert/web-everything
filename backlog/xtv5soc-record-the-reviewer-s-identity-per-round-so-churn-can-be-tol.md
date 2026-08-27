---
kind: story
size: 1
parent: "3318"
status: open
dateOpened: "2026-08-27"
scope:
  - we:scripts/review-corpus/mine-review-corpus.mjs
tags: []
---

# Record the reviewer's identity per round, so churn can be told from version drift

The corpus records no model id, prompt revision, roster or care setting per round. So the measured 100 percent finding churn across repeated runs on identical input cannot be separated from the reviewer having changed between them — a one-field fix at mining time.

## Why this is worth a card of its own

[#3310](/backlog/3310/) measured run-to-run stability against the real corpus and found the program's most
alarming number so far: across **5 recorded pairs where the reviewer ran twice on a byte-identical head sha**,
**0 of 7 findings recurred** — 100% pooled finding-set churn, 83.3% under the loosest matcher — and a **20%
verdict-flip rate**, with one PR answering `accept` and then `changes` on the same diff.

That number has one ambiguity, and it is fatal to acting on it: **the corpus does not record who reviewed.**
No model id, no prompt revision, no roster, no care setting. So a finding that appears in round 6 and not in
round 7 might be juror nondeterminism, or might be an entirely different reviewer — a changed model, a changed
prompt, a different lens roster. **Those two readings call for opposite responses**, and nothing in the record
separates them.

Fixing it is one field written at mining time. The measurement already exists and will re-run.

## What to record

Enough to answer *"was this the same reviewer?"* — at minimum the model id, and whatever identifies the prompt
and roster the round ran under. The bar is comparability between two rounds, not a full provenance dossier.

Note the rounds already recorded **cannot** be back-filled; whatever is captured starts the clock. That is a
reason to capture slightly more than seems necessary, not less.

## What this does NOT fix

The stability figure has other limits, recorded on #3310 and not addressed here:

- **n = 5 pairs, 7 pooled findings.** Adding a field does not add samples.
- **Convenience sample.** A round repeats on an unchanged head because a human re-ran it, which correlates
  with rounds going badly — plausibly biased toward the unstable end, and the bias direction is not estimable
  from the corpus.
- It covers four PRs. Nothing outside them.

So this card makes the *existing* number interpretable. A trustworthy rate needs deliberate repeated runs,
which cost real money per run and are a separate item.

## Done when

1. **Executable** — a newly mined round carries the reviewer-identity field, and a test asserts a round missing
   it is reported as **unknown** rather than silently compared. Both directions: the failure to avoid is a
   comparison that quietly assumes two rounds shared a reviewer.
2. `npm run check:standards` — 0 errors.
