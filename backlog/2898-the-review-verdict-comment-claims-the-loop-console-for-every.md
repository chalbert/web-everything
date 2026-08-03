---
bornAs: xexz7q7
kind: story
size: 1
status: open
blockedBy: ["2882"]
relatedTo: ["2644", "2439"]
scope:
  - we:scripts/review-set-label.mjs
  - we:scripts/__tests__/review-set-label.test.mjs
dateOpened: "2026-08-03"
tags: [review, cli, attribution, single-home]
---

# The review-verdict comment claims the loop console for every caller, including a human /review

buildVerdictComment in we:scripts/review-set-label.mjs hardcodes the sentence naming the Plateau Loop review console as the channel. That module is now the single home for three callers — the loop console, the conveyor fix-agent re-arm, and since #2882 the human /review ceremony — so a verdict recorded by a human in a session posts a comment claiming a channel it did not come through. The actor is attributed correctly; the channel is not. Make the channel an input alongside --actor so each caller renders a truthful attribution.

## How it got here

The comment body was written when the module had exactly one caller, so the channel was a constant rather than a
parameter. #2644 collapsed the conveyor re-arm onto the same harness and #2882 routed `/review` onto it. Each of
those was the right move — but the fixed sentence came along unchanged, and now asserts something false for two of
the three callers.

## Observed

The human accept on PR #1005 posted `Recorded by Nicolas Gilbert (human /review) via the Plateau Loop review
console.` The actor string was the only thing distinguishing it from a console-recorded verdict, and only because
the reviewer happened to put the ceremony in the `--actor` value.

## Why it is worth the small fix

we:skills-src/review/SKILL.md promises the human verdict is "marked clearly as the human decision so it is never
mistaken for the drain's advisory take". The header the CLI emits is caller-agnostic and the channel line is
actively wrong, so that promise rests entirely on a free-text `--actor` the skill does not constrain. #2439's
independence story is about which *actor* produced versus cleared a diff — a durable record that misnames the
channel makes that after-the-fact reconstruction harder for no reason.

## Definition of done

- The channel is an input, not a constant: each caller supplies it (the loop console, the conveyor re-arm, and
  `/review`), and `buildVerdictComment` renders what it is given.
- A caller that supplies nothing gets a neutral sentence, never another caller's channel name.
- A test asserts the rendered attribution differs per caller, so a fourth caller cannot silently inherit a third's
  identity the way `/review` inherited the console's.
