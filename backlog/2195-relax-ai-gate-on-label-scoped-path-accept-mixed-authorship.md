---
kind: story
size: 2
parent: "2193"
status: resolved
dateOpened: "2026-07-03"
blockedBy: ["2196", "2194"]
dateStarted: "2026-07-03"
dateResolved: "2026-07-03"
tags: [lane, pr-flow, merge-queue, session-tooling, drain]
---

# Relax the AI-gate on the label-scoped path — accept mixed human+AI PRs

Today `we:scripts/merge-ai-prs.mjs` requires **every** substantive commit to carry the `Co-Authored-By: Claude`
trailer (`isAiGeneratedPr` at `we:scripts/merge-ai-prs.mjs:84`, applied unconditionally at
`we:scripts/merge-ai-prs.mjs:112`). That is correct for the **bare `/merge` orphan sweep** (no label → the
trailer is the only signal the work is AI). But on the **label-scoped path** (`--label=ready-to-merge`) the
label **is** the human/producer signal, so the every-commit check is redundant and over-strict — it wrongly
skips a genuinely-AI PR that happens to carry one hand-authored commit (observed: PRs #40/#42 skipped
"not AI-generated").

Fix: make the every-commit-AI requirement **conditional on label absence**. When `ready-to-merge` is present,
collect the PR on green + mergeable alone (mixed authorship allowed). When absent (orphan sweep), keep the
strict gate unchanged.

**blockedBy #2196:** relaxing this makes the label the SOLE authorization for auto-merging unreviewed human
commits — safe ONLY once the label is exclusively producer-applied (#2196). Land after #2196. Add a unit test
for both branches (labelled-mixed → merge; unlabelled-mixed → skip).
