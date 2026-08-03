---
bornAs: x2uoj30
kind: task
status: open
dateOpened: "2026-08-03"
tags: [review-integrity, trust-chain, agent-working-style, verification]
relatedTo: ["2899", "2900", "2439", "2326"]
scope:
  - we:skills-src/pr/SKILL.md
  - we:docs/agent/testing.md
---

# Run `/code-review` on a trust-chain diff BEFORE `pr-land`, not after the label

An agent that authors a change to the trust chain must review its own working diff **before** opening the PR.
The `/review` skill already says so — *"review your own working diff before you open the PR (that is
`/code-review`)"* — and on 2026-08-03 that step was skipped for two PRs in a row. Both were labelled
`ready-to-merge` on the strength of self-verification, and an advisory jury then found real defects in both.

## What went wrong, concretely

**PR #1020 (#2900).** The guard it added did not fire in this repo's normal execution context: `laneTreeVerdict`
allowed **any** tree whenever the running script lived in a lane clone, which every agent session does. The
primary checkout — the exact thing being refused — passed.

**PR #1017 (#2899).** `flipped: true` was returned even when the commit failed, so a failed flip logged
`✓ resolved on land … + pushed to main`; and a withheld couple was dropped with no report and no retry.

Both were labelled green. Both were caught only after the fact.

## The verification gap this exposes

Both PRs claimed to be **mutation-verified**, and the claim was true but much narrower than it sounded:

> "Reverting X fails N tests" pins the **decision**. It says nothing about whether the decision is **reachable**,
> or whether a step that silently does nothing would be **noticed**.

For #1020 the mutation forced the *verdict* to `ok:true` — which the test matrix does catch — and never removed
the branch that made `ok:true` reachable for the primary. The unit test for that branch was itself vacuous: it
passed `tree: LANE`, which returned at an earlier branch, so deleting the line left the suite green. The author
verified the thing that was already right.

**Two questions mutation testing does not ask, and a reviewer does:** *is this branch reachable in production?*
and *if this step silently does nothing, does anything notice?*

## Definition of done

- **A1 — the rule, where an author will hit it.** `we:skills-src/pr/SKILL.md`: a diff touching the trust chain
  ([we:scripts/merge-ai-prs.mjs](scripts/merge-ai-prs.mjs), [we:scripts/lane-drain.mjs](scripts/lane-drain.mjs),
  [we:scripts/lane-stack.mjs](scripts/lane-stack.mjs), `we:scripts/lib/review-*.mjs`) runs `/code-review` on the
  working diff **before** `pr-land`, and the PR body states the outcome. The trust-chain set is read from
  `we:scripts/lib/gate-config.mjs`, never re-listed by hand.
- **A2 — say what mutation testing proved.** `we:docs/agent/testing.md`: a mutation claim must name what it
  pinned. "Reverting X fails N tests" is evidence the decision is bound — not that it is reachable, nor that a
  no-op would be observed. Both remain the reviewer's job.
- **A3 — no new blocking gate.** This is authoring discipline, not another park. The drain's existing
  blast-radius escalation already routes these PRs to review; this is about not *arriving* there with defects a
  cheap pre-PR pass would have caught.

## Explicitly NOT a full jury per PR

The two juries that found these took roughly 90 minutes and >2M tokens each. That cost is right for a parked PR
under human review; it is wrong as a pre-PR step. `/code-review` on the working diff is the cheap version, and it
is the one already prescribed.
