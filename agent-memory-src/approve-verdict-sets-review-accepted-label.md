---
name: approve_verdict_sets_review_accepted_label
description: When the user says they approve a PR, that verdict = swap its review label to review:accepted (drain may merge) — do it without being asked
metadata:
  node_type: memory
  type: feedback
  originSessionId: 51ac2426-e7bb-4815-8f6c-5c9a3372cd96
---

When the user says "I approve" / "I approved #N" (or equivalent) for a PR, that
utterance **is** the human review verdict — action it by swapping the PR's review
label to `review:accepted` (removing `review:human` / `review:pending`) so the
drain may merge it. Do this automatically; do not ask, and do not treat "I
approve" as mere FYI.

**Why:** in this repo's review flow the human verdict is recorded via the label
(`review:human`/`review:pending` → `review:accepted`, or `review:changes` to
bounce the fix back to the author lane). Saying "I approve" and then me leaving
the label untouched strands the PR — the drain only lands `review:accepted`. The
user was explicit: "that is my expectation when I say I approve." Missing it once
already cost a round-trip.

**How to apply:** on an approval,
`gh pr edit <N> --add-label review:accepted --remove-label review:human`
(or `--remove-label review:pending`), confirm the resulting labels, and report
the PR now carries `ready-to-merge` + `review:accepted` for the next drain. Do
NOT merge directly unless separately asked (the drain is the land route —
[[pr-is-the-standard-flow-not-a-question]]). Bounce with `review:changes` only
when the user asks for changes.
