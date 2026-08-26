---
bornAs: xxfv35j
kind: story
size: 3
parent: "3029"
status: open
relatedTo: ["2450"]
scope: ["we:scripts/check-standards-rules.mjs", "we:scripts/__tests__/check-standards-rules.test.mjs"]
dateOpened: "2026-08-25"
tags: [prevention, review, gate, pr-body, net-diff]
---

# A changed-file count claimed about a PR is taken from the three-dot list, not the net diff

A PR body or card can state how many files a PR changed, taking the number from `gh pr view --json files` or `gh pr diff` — a three-dot list that also counts files sibling lanes landed on main. This repo's ground truth is the net basis, and the three-dot figure is always the larger. Owed by two CONFIRMED findings on PR #1563, where #1556's merge was described as carrying 13 changed files when its net diff carried 3. Ground truth is mechanical: which command produced the number.

## Why a gate rather than a convention

The convention is already written down and already enforced elsewhere. `#2450` resolved this exact class for
the drain's review panels — three-dot diffs made files that sibling lanes had landed look like scope creep —
and the fix shipped as `computeNetDiffChangedFiles` (`we:scripts/merge-ai-prs.mjs:2117`) over a resolved
basis (`resolveNetDiffBasis`, `:2060`). The `review-pr` operation stamps every verdict with that basis, and
#1556's own review comment quotes the distinction verbatim. None of that reaches a **prose** claim in a card
or a description, which is where this defect landed.

It is not a rounding error. On the motivating case the two answers were **3** and **13**:

```text
git diff --name-only 14cd7c60^1 14cd7c60      → 3 paths   (net: #1556's merge, first-parent)
gh pr view 1556 --json files                  → 13 paths  (three-dot, merge-base…head)
```

The ten extras were `agent-memory-src/` entries and `backlog/` `3118`, `3165`, `3273`, `3277`–`3281`, each
landed on `main` by a sibling lane — #1558, #1562, #1565 and the `drain: JIT-number … at land` commits — not
by #1556. The inflation is unbounded: it grows with how busy the queue was, so the claim is most wrong
exactly when the reader is least able to check it by eye.

## Why the direction matters

A `changedFiles` set is the **denominator** of other checks — `3299` compares the ids a body claims
against the `backlog/<id>-*.md` paths in the diff. Seeding that from the three-dot list adds cards the PR
never touched, so a claim about a sibling lane's card silently passes. Over-counting the diff under-reports
the finding.

## What it must not do

**It must not run git or call the network.** The rule sees a card or body string and, where the caller has
one, the basis label the diff was produced on. Resolving a PR to a diff is `resolveNetDiffBasis`'s job and it
already exists; a second implementation here would drift from the drain's and report a third answer.

**It must not flag every number near the word "files".** A count of files a card *proposes to touch*, a
`scope:` length, a test-fixture size are ordinary. Only a count asserted about a **specific PR's** diff — an
`#N` or a PR URL near the count — is in scope.

**It must not demand the number be recomputed.** A claim that names the basis it was measured on
(*"3 on the net basis"*, *"13 on `gh pr view`'s three-dot list"*) is the required form and must stay green.
Anchored is honest; bare is not. This is `3304`'s rule for warning counts, applied to file counts.

**It must not fire on a RETRACTION or a quoted fixture.** This card quotes *"13 changed files"* above in
order to say it was wrong, and the card it is filed alongside — `3299` — carries a retraction that quotes
the same figure. Flagging the cards that document the defect is the false positive that gets the rule
deleted. The same negation `3299` criterion 4, `3305` criterion 4 and `3304` criterion 4 all need.

## Interfaces

A pure function in `we:scripts/check-standards-rules.mjs` over a body string, returning findings. No
filesystem, no git, no network — the input is text.

## Done when

1. **Executable** — PR #1563's round-5 body text *"#1556 has since merged (2026-08-26) carrying 13 changed
   files, not three"*, with no basis named, reports exactly one finding naming `1556`. Real input, taken from
   this card's own PR before the round-6 fix.
2. **Executable** — the same sentence with the basis named — *"13 paths on `gh pr view`'s three-dot list; 3
   on the net basis"* — reports **none**. The pair is what makes the rule's boundary a fact rather than a
   preference: the defect is the missing methodology, not the number.
3. **Executable** — a count of files with no PR reference nearby (a `scope:` length, *"this item touches two
   files"*) reports none, so the rule does not fire on ordinary prose.
4. **Executable** — **this card's own body reports none**, and so does `3299`'s corrected criterion 1.
   Both still contain *"13"* beside *"changed files"* and beside `#1556`, because both quote the wrong figure
   in order to retract it. Taken from the real files, not constructed.
5. **Mutation** — dropping the basis-named exclusion reddens case 2; dropping the PR-reference predicate
   reddens case 3; dropping the retraction negation reddens case 4 and nothing else.
6. `npm run check:standards` — no new errors and no new warnings against the baseline at build time.
