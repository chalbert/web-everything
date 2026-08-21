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

## Design

**Both target files are currently silent on this, which is what makes the change provable.** Verified
2026-08-21: `grep -n "code-review" we:skills-src/pr/SKILL.md` returns nothing, and `grep -n "mutation"
we:docs/agent/testing.md` returns nothing. So both A1 and A2 are additions to files that today contain no
version of the rule — a before/after assertion has somewhere to bite.

**A1 — where in the skill.** we:skills-src/pr/SKILL.md is organised `Preconditions` → `Never open a PR any
other way` → `Steps`. The rule is a **precondition**, not a step: it must fire before the first `pr-land
--dry-run` line, in the same block that already says the work must be committed. Putting it inside `Steps`
means the author reads it after they have already decided to open.

**A1 — the set is TWO rosters, and picking only the trust chain would miss this card's own worse incident.**
This is the part that can go wrong quietly, and it nearly did. The card's A1 wording lists three paths inline
(we:scripts/merge-ai-prs.mjs, we:scripts/lane-drain.mjs, we:scripts/lane-stack.mjs) *and* says the set is read
from we:scripts/lib/gate-config.mjs. Verified 2026-08-21: **only we:scripts/merge-ai-prs.mjs is a
`TRUST_CHAIN` member.** we:scripts/lane-drain.mjs and we:scripts/lane-stack.mjs live in the *other* roster —
`BLAST_RADIUS_ENGINE` in we:scripts/lib/review-escalation.mjs (roles `drain` and `lane-stack`).

That is not a wording nit. **PR #1020 (`#2900`) — the more serious of the two motivating incidents — touched
we:scripts/lane-stack.mjs, we:scripts/readiness/lane-tree-guard.mjs and two test files, and NONE of them is a
`TRUST_CHAIN` member.** A precondition scoped strictly to `isTrustChainPath` would not have fired on it. So the
predicate the doc names must be the **union both rosters already compose**, which the repo computes in one
place: `scoreEscalation`'s blast-radius signal is
`changedFiles.filter((f) => isBlastRadiusPath(f) || isTrustChainPath(f))`. Name that union, not the trust chain
alone.

Mechanics, so the doc stays derived: `TRUST_CHAIN` is the roster, `TRUST_CHAIN_BASENAMES` its derived Set,
`isTrustChainPath(path)` the matcher — all exported from we:scripts/lib/gate-config.mjs and matched **by
basename** so a member travels when it relocates; `isBlastRadiusPath` (we:scripts/lib/review-escalation.mjs) is
the sibling matcher over `BLAST_RADIUS` + `BLAST_RADIUS_ENGINE_BASENAMES`. The doc should name the
*predicates*, and any illustrative paths it prints must be a subset of the live rosters, not a hand-kept
parallel list. we:scripts/lib/gate-config.mjs is itself registered in the trust chain (the documented
"closure"), so widening the set is already human-reviewed — that file must not gain a second, un-gated copy of
its own roster in prose.

**A2 — what the sentence has to say.** The distinction is already written well in *The verification gap this
exposes* above; A2 is lifting it into we:docs/agent/testing.md next to the existing
*"Proof-based verification — observe before you claim"* section, which is where a claim's wording is already
governed. The two questions to name verbatim: *is this branch reachable in production?* and *if this step
silently does nothing, does anything notice?*

**A3 is a non-goal, and non-goals are worth pinning too** — no `check:standards` rule, no new park, no new
label. The drain's blast-radius escalation already routes these PRs; this item changes what an author does
before that, not what the gate does after.

**How to pin prose without a brittle test.** This repo already solved that: `proseContains` /
`normalizeProse` in we:scripts/lib/__tests__/doc-prose.mjs collapse whitespace and strip blockquote markers, and
we:scripts/lib/__tests__/jury-core.test.mjs already uses them to pin safety-control sentences in
we:skills-src/drain/SKILL.md. Use the same helper; do **not** write a line-anchored `toContain`.

## Done when

- **Tier 1** — a test (beside the existing prose assertions in we:scripts/lib/__tests__/) reads
  we:skills-src/pr/SKILL.md and asserts, via `proseContains`, that it prescribes `/code-review` on the working
  diff **before** `pr-land` for a trust-chain diff, and that the PR body states the outcome. It fails today —
  the file does not contain the string `code-review` at all.
- **Tier 1** — the same test asserts the doc's roster reference is **derived, not re-listed**: every code-path
  basename the A1 block names satisfies `isTrustChainPath(f) || isBlastRadiusPath(f)` — the union
  `scoreEscalation` already composes, not `TRUST_CHAIN_BASENAMES` alone. A doc that drifts from either roster
  then fails the suite, which is the only mechanism that makes "never re-listed by hand" more than a wish.
- **Tier 1** — a regression test on this card's own motivating case: the touch-set of PR #1020 / `#2900`
  (we:scripts/lane-stack.mjs, we:scripts/readiness/lane-tree-guard.mjs plus its two test files) satisfies the
  predicate the doc names. Under `isTrustChainPath` alone this test is RED — which is the point: it is what
  stops the rule shipping scoped so narrowly that it would not have caught the incident it was filed for.
- **Tier 1** — a test reads we:docs/agent/testing.md and asserts both reviewer questions are present verbatim
  (*reachable in production*, *silently does nothing*), alongside the statement that a mutation claim must name
  what it pinned. It fails today — the file contains no occurrence of "mutation".
- **Tier 2** — A3 is honoured: `git diff --stat` for the change touches only we:skills-src/pr/SKILL.md,
  we:docs/agent/testing.md and the new test file. No edit to we:scripts/check-standards.mjs,
  we:scripts/merge-ai-prs.mjs, or any label/park path.
- **Tier 3** — the cost boundary is stated where an author would otherwise over-apply it: the A1 block says
  this is `/code-review`, explicitly not a jury, and cites the measured reason (~90 min and >2M tokens per
  jury). Read the added block — if it does not name the cheap tool by name, an author will reach for the
  expensive one.

## Independent review — 2026-08-21

Confidence: **Medium**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (NOT addressed at the time of review; strategy: check by mutation or reversion ahead of the build) — The card asserts its A1 illustrative trust-chain paths (we:scripts/merge-ai-prs.mjs, we:scripts/lane-drain.mjs, we:scripts/lane-stack.mjs) are 'read from we:scripts/lib/gate-config.mjs', but only we:scripts/merge-ai-prs.mjs is actually a member of TRUST_CHAIN_BASENAMES there; we:scripts/lane-drain.mjs and we:scripts/lane-stack.mjs are registered instead in the separate blast-radius roster in we:scripts/lib/review-escalation.mjs. The card's own 'Design' section flags the wording as 'self-contradictory' but does not catch that two of its three named examples fail the very membership test it specifies as Tier 1.
- **decorative-guard** (addressed; strategy: mutate the guarded line; require a NAMED test to redden) — The Done-when section is explicit that each Tier-1 test currently fails (the target strings are absent today), giving a concrete red-to-green bar rather than a check that could pass vacuously.

**Corrections applied by this review:**

- The card's A1 worked example names we:scripts/lane-drain.mjs and we:scripts/lane-stack.mjs as trust-chain paths, but neither is a member of TRUST_CHAIN_BASENAMES in we:scripts/lib/gate-config.mjs (verified live: only we:scripts/merge-ai-prs.mjs among the three is a member) — they are instead registered in the separate blast-radius roster in we:scripts/lib/review-escalation.mjs.
- PR #1020 (backlog `#2900`), the more serious of the two motivating incidents, touched only we:scripts/lane-stack.mjs, we:scripts/readiness/lane-tree-guard.mjs, and two test files per its own frontmatter scope — none of which are TRUST_CHAIN members — so a precondition scoped strictly to isTrustChainPath(f)/TRUST_CHAIN_BASENAMES, as the card's own Tier-1 basename test requires, would not have fired on it.

The card's textual claims about the two target files (both currently silent on `/code-review` and on mutation claims, the Preconditions→Steps structure of we:skills-src/pr/SKILL.md, doc-prose helper reuse) all check out against the live repo, but its own worked A1 example conflates two different rosters, so the scoped rule it prescribes would not have fired on the more serious of its two motivating incidents.

_Recorded through the declared `review-prep` operation._

**Driver disposition (2026-08-21).** Both findings accepted — this was the most consequential correction of the
batch, because the rule as prepared would not have caught its own worse incident. Verified independently:
grepping we:scripts/lib/gate-config.mjs for the `lane-drain` and `lane-stack` basenames returns **nothing**; both are
`BLAST_RADIUS_ENGINE` members in we:scripts/lib/review-escalation.mjs (roles `drain` and `lane-stack`), and
`#2900`'s own `scope` frontmatter lists we:scripts/lane-stack.mjs and we:scripts/readiness/lane-tree-guard.mjs
— no `TRUST_CHAIN` member among them. Design A1 now names the **union** the repo already composes in
`scoreEscalation` (`isBlastRadiusPath(f) || isTrustChainPath(f)`) rather than the trust chain alone, and a new
tier-1 criterion pins `#2900`'s actual touch-set against that predicate — a test that is RED under the narrow
scoping, so the mis-scoping cannot ship silently.
