---
kind: story
size: 2
relatedTo: ["2193", "2194", "2199"]
status: open
dateOpened: "2026-07-03"
tags: [lane, pr-flow, merge-queue, drain, git]
---

# The drain re-polls once after a producer labels, to absorb the `ready-to-merge` propagation lag

The `--label-on-green` producer (`we:scripts/pr-land.mjs`) applies the `ready-to-merge` label, then a one-shot
drain (`we:scripts/merge-ai-prs.mjs --label=ready-to-merge`) collects it. But GitHub's `gh pr list --label`
index lags the `gh pr edit --add-label` write by a few seconds, so a drain run fired **immediately** after
labelling can read the just-labelled PR as **absent** and report "0 AI PR(s) to merge" — the PR is stranded
until a manual re-run. Observed live 2026-07-03: PR #72 was green + labelled, the first drain pass saw only the
unrelated red PR ("0 to merge, 1 skipped"), and an immediate second run landed it cleanly.

**Fix (small):** when a `--label`-scoped one-shot drain finds **zero** labelled candidates (or fewer than a
caller-supplied `--expect=N`), **re-poll once** after a short delay (~3–5s) before concluding the queue is
empty — the label index almost always catches up within one retry. Alternatively/additionally, document that
`--watch` already absorbs this (its next interval re-lists), so the race only bites the bare one-shot. Keep it
fail-soft: a still-empty re-poll is a legitimate empty queue, not an error. Add a unit test on the pure
"should re-poll?" decision (zero-found + not-yet-retried → retry once). Relates to #2194 (the label lander) and
#2199 (the `--label-on-green` handoff that surfaces the lag).
