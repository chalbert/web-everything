---
bornAs: xexz7q7
kind: story
size: 1
status: resolved
blockedBy: ["2882"]
relatedTo: ["2644", "2439"]
scope:
  - we:scripts/review-set-label.mjs
  - we:scripts/__tests__/review-set-label.test.mjs
dateOpened: "2026-08-03"
dateResolved: "2026-08-10"
graduatedTo: scripts/review-set-label.mjs
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

## Resolved

The fourth caller arrived before the fix did, and made the defect self-evident rather than merely arguable: the
first live run of the declared `review-pr` operation (#3035) posted a comment on PR #1146 whose attribution
credited the Plateau Loop review console **three lines above its own footer** saying *"Recorded through the
declared `review-pr` operation (#3035)"*. One durable record, two provenances.

What landed:

- `--channel=<surface>` on [we:scripts/review-set-label.mjs](../scripts/review-set-label.mjs), rendered by
  `buildVerdictComment`. Absent → `Recorded by <actor>.`, the neutral sentence, never another caller's channel.
- `normalizeChannel` treats it as one clause of one sentence: whitespace collapsed, trailing stop trimmed, and
  `reviewed-sha` markers STRIPPED — a `changes` verdict appends no marker of its own, so a marker smuggled
  through argv would otherwise be the only one in the body and would read as this verdict's SHA claim.
- It joins `--actor` / `--reason` in `projectVerdictCommentLength`, so an over-long channel trips the size
  pre-flight before any `gh` call (the PR #1057 lesson about unprojected free text).
- The two in-repo callers state their own surface: the `review-pr` operation
  ([we:scripts/operations/review-pr.mjs#REVIEW_PR_CHANNEL](../scripts/operations/review-pr.mjs), passed through
  the label sink) and the unattended auto-land seam
  ([we:scripts/lib/auto-land-seam.mjs#buildSetLabelArgs](../scripts/lib/auto-land-seam.mjs), which says in the
  comment that no human recorded the verdict). `clear-human` is untouched: its attribution already names its own
  channel (the ceremony and the tool), so a second channel clause would restate it.

Not done here, and deliberately: the **loop console itself** lives in `plateau:tools/dev-panel/vite-plugin.ts`
and is not this repo's to edit. It supplies no `--channel`, so it now renders the neutral sentence — truthful,
just less specific than it could be. Passing `--channel=the Plateau Loop review console` from the panel is a
one-line plateau-side change; until it lands the console's record understates rather than misstates, which is
the direction this item exists to move in.
