---
kind: story
size: 2
parent: "3054"
status: open
dateOpened: "2026-08-10"
tags: [gate, review, drain, review-escalation, fingerprint, evidence]
scope:
  - we:scripts/measure-contribution-digest.mjs
  - we:backlog/3054-the-acceptance-coverage-digest-re-parks-a-cleared-pr-whose-c.md
  - we:backlog/3046-a-stale-acceptance-re-park-fires-on-an-unchanged-contributio.md
---

# The digest repair's corpus figures ship without the script that produced them

PR #1158 warrants a deliberate fail-open widening with three corpus figures (16 stamped accept→head pairs, 201
machine-replayed rebases, 181 genuine changes) that no committed script reproduces — the exact defect
[#3028](/backlog/3028-judge-helper-the-tool-free-juror-spawn-behind-one-function/) already refused twice.
Commit the generator, or the numbers stay uncitable.

**The numbers are probably right. They are currently uncitable.** This item is not a challenge to the result —
an independent review of #1158 checked the one thing it could check by hand and found it sound. It is a
challenge to the *record*: a figure nobody can re-derive is not evidence, and this repo has already said so
twice, in writing, about smaller stakes than these.

## What is claimed, and where

#1158 (`lane/3054-digest`, closing #3046 and #3052 under epic
[#3054](/backlog/3054-the-acceptance-coverage-digest-re-parks-a-cleared-pr-whose-c/)) reports three corpora:

| corpus | n | before | after |
| --- | --- | --- | --- |
| stamped accept→head pairs from recent history, each self-certified against its own marker | 16 | 2 false stales | 0 |
| machine-replayed content-preserving rebases (`git merge-tree` onto 4 bases, 80 merged PRs) | 201 | 3 false stales | 0 |
| genuine contribution changes (consecutive commits on a PR branch, same base) | 181 | 181/181 detected | 181/181 |

They are not confined to the pull-request description. The 16/201/181 figures are written into the **cards** as
well — `#3054`'s *DIGEST REPAIRED* banner and `#3046`'s resolution banner both carry them (there, the two
false-stale counts are summed as "5 false stales before, **0** after"). So they outlive the PR and become the
standing account of why the widening was affordable.

## What is missing

#1158's diff is **eight files** — four backlog cards,
[we:scripts/lib/review-escalation.mjs](scripts/lib/review-escalation.mjs),
[we:scripts/lib/verdict-ledger.mjs](scripts/lib/verdict-ledger.mjs), and their two test files. **No generation
script.** Nothing in the change selects the 16 pairs, replays the 201 rebases, or enumerates the 181 genuine
changes; nothing records the conditions (which repo, which commit range, which four bases, which 80 PRs, when).
The independent review could regenerate none of the three and marked all three unverified.

What *is* independently checkable is the adversarial case embedded in the suite — the `RIDE_IN` fixture in
[we:scripts/lib/__tests__/review-escalation.test.mjs](scripts/lib/__tests__/review-escalation.test.mjs), which
pins that a line appended to an otherwise-rebased diff still fails coverage. That one holds. It is one case,
and it is not the corpus.

## Why this is a repeat, not a nitpick

[#3028](/backlog/3028-judge-helper-the-tool-free-juror-spawn-behind-one-function/) (resolved 2026-08-09) ruled
on this exact shape and used almost these words:

> **The measurement lands with the helper, or not at all.** A committed script — argv in, loaded-context and
> wall clock out — that anyone can re-run, plus its recorded conditions (cwd, model, prompt). Until that exists
> no number is carried.

Two earlier figures on that item **were withdrawn** for lacking precisely this, and the card says why: "neither
recorded its conditions". What replaced them was
[we:scripts/measure-judge-spawn.mjs](scripts/measure-judge-spawn.mjs) plus a conditions block naming cwd,
`git HEAD`, CLI version, model, effort, sample count, OS, node version, date and spend — and the explicit
instruction to *re-run the script rather than quote the row*.

The same posture is already statute.
[we:docs/agent/platform-decisions.md](docs/agent/platform-decisions.md) declines to carry an over-flag
percentage for the quote-aware splitter for one stated reason: "*No over-flag percentage is carried here:* the
ratio moves with the token list used and no committed script reproduces it." It keeps the **direction** and
drops the **number**.

#3054's figures cannot take that escape hatch, because there the number *is* the argument. They are the warrant
for accepting a **deliberate fail-open widening** — `#3021`'s false-honour class was knowingly made wider, and
the case for paying that price is "in production the dropped signals fired on the base 2 times out of 2 while
catching a real relocation 0 times out of 0." Strip the corpus and that sentence has nothing under it.

## What done looks like

- A committed script — argv in, counts out; `we:scripts/measure-contribution-digest.mjs` is the natural home —
  that rebuilds all three corpora from real git history. It is derived data, not a hand-curated sample, so it
  should be re-derivable by construction.
- Run it against the **pre-fix** and **post-fix** projection, printing both columns, so the before/after is a
  script output rather than a claim.
- A conditions block beside the table, in `#3028`'s shape: repo, commit range or `git HEAD`, the four bases,
  the PR set, node/OS, date.
- Then either the existing card figures are re-stamped as that script's recorded run (marked a sample, not a
  constant), or they come out of the cards the way the platform-decisions anchor handles it — direction kept,
  number dropped.

## What this item is not

It does **not** re-open the digest repair, ask for the widening to be reversed, or claim any figure is wrong.
The repair's own falsifiable content — the two incidents replaying to matching digests, THE
INDISTINGUISHABILITY reproduced from real `git diff` output, the run-shape refusal — is in the unit suite and
is checkable today. Only the corpus is not.

Related: [#3021](/backlog/3021-the-contribution-fingerprint-still-collides-on-an-intra-sect/) (the class the
figures were spent to widen), `#3046`, `#3052`.
