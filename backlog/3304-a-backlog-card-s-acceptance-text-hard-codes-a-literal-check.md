---
bornAs: xo5pueh
kind: story
size: 3
parent: "3029"
status: open
relatedTo: ["3238"]
scaffoldedBy: "conv-1563"
dateScaffolded: "2026-08-25"
scope: ["we:scripts/check-standards-rules.mjs", "we:scripts/__tests__/check-standards-rules.test.mjs"]
dateOpened: "2026-08-25"
tags: [prevention, gate, backlog, acceptance-criteria]
---

# A backlog card's acceptance text hard-codes a literal check:standards warning count

A backlog card's Done-when can hard-code a literal `check:standards` count as its target, and the number goes stale before a builder ever reads it. Owed by a CONFIRMED finding on PR #1556, where two cards named a 1435-warning baseline while `main` measured 1437, and a third card in the same cluster already modelled the fix by phrasing its criterion as a delta measured at build time. A builder asked for a precise count delta against a wrong total chases an unrelated regression. Ground truth is a literal integer in acceptance text beside `check:standards`.

## Why a gate rather than a convention

The convention already exists and is already written down — inside the very cluster that broke it. `#3233`'s
Done-when 8, at `ee6e5a98` — the `prep r7` commit on #1556's branch, **not** its head — reads:

> `npm run check:standards` shows no new errors and no new warnings **against the baseline at build time**
> — do not hard-code a number; it has already moved twice while this card was being prepared.

*(Retracted, not deleted. An earlier version of the sentence above, and of Done-when 1 and 2 below, called
`ee6e5a98` **"PR #1556's head"**. **That was wrong.** `gh pr view 1556 --json headRefOid` returns
`74c1c9f0`, merged as `14cd7c60`; `ee6e5a98` is the intermediate `prep r7` commit, superseded by `6250a0a2`
(`prep r9`) before this card was authored. The **pin is right and stays** — every fixture below reproduces at
`ee6e5a98`, verified — but the label inverted them: at the real head `74c1c9f0`, `#3238`'s DW7 and `#3230`'s
DW6 are already in the delta form and the `1435` literal survives only inside a retraction, which this card's
own "must not fire on a RETRACTION" negation says must report **none**. A builder who resolved the label
instead of the sha would have got the opposite of the stated expectation and concluded their rule was broken.
`3297` is filed for exactly this — owed by the review that caught it.)*

Two sibling cards prepared in the same PR, by the same author, in the same sitting, hard-coded **1435**
anyway. A round-7 edit removed the literal from one card and left it in two — so the cluster ended up handing
a builder a number twice while telling them once not to trust it. A convention that loses to itself inside
one PR is a convention that needs a script.

**The number was already wrong when it was written.** `main` measured **1437** at review time, a two-warning
drift from unrelated sibling-lane merges. Nobody made a mistake about the count; the count moved. That is the
whole argument: the literal is self-invalidating by construction, so the fix is to forbid the form, not to
keep re-measuring it.

## Why it is not merely cosmetic

`#3238`'s Done-when 7 is the case that costs time. It does not ask for pass/fail — it asks for a **precise
count delta** ("drops by **one**") measured against the stated total. A builder counting warnings against a
total that is wrong by two either starts from an already-false criterion, or reads the pre-existing drift as
a regression their own change introduced and goes hunting for it.

## What it must not do

**It must not flag every number in a card.** Sizes, item ids, line numbers, counts of test cases and
measured deltas are all ordinary. Only an integer standing as a `check:standards` **error or warning total**
is in scope — the co-occurrence is the predicate, not the digit.

**It must not flag a delta.** *"no new warnings against the baseline at build time"*, *"drops by one"*,
*"+6 items"* are the required form, not the defect. A card that states a measured delta must stay green, or
the rule forbids the thing it is trying to encourage.

**It must not flag a dated measurement.** A card that says *"1437 on `main` at `60acbe5f`, 2026-08-25"* has
named the tree it measured, so a reader can tell staleness from error. Anchored is honest; bare is not.

**It must not fire on a RETRACTION or on a quoted fixture.** This card quotes `0-error / 1435-warning` above
in order to say it was wrong, and this is the same negation `3299` criterion 4 and `3305` criterion 4
both need. Flagging the card that documents the defect is the false positive that gets the rule deleted.

## Interfaces

A pure function in `we:scripts/check-standards-rules.mjs` over a card's acceptance text, returning findings.
No filesystem, no git, no gate run — the input is a string.

## Done when

1. **Executable** — `#3238`'s Done-when 7 at `ee6e5a98` (*"no NEW warnings against the 0-error /
   1435-warning baseline"*) reports exactly one finding, and `#3230`'s Done-when 6 at the same commit reports
   one. Real input, both. `ee6e5a98` is an intermediate commit on #1556's branch, not its head — pin the sha,
   do not resolve the PR, or both fixtures invert (see the retraction above).
2. **Executable** — `#3233`'s Done-when 8 at the same commit (*"against the baseline at build time — do not
   hard-code a number"*) reports **none**. Same cluster, same PR, same author: the pair is what makes the
   rule's boundary a fact rather than a preference.
3. **Executable** — the rest of `#3238`'s Done-when 7, which asks for a count that *drops by one*, reports
   none. A delta is the required form.
4. **Executable** — a criterion naming a total **with the tree it was measured on** reports none, and this
   card's own quoted retraction of `0-error / 1435-warning` reports none.
5. **Executable** — a card carrying a bare integer with no `check:standards` nearby (a `size`, an item id, a
   line number) reports none.
6. **Mutation** — dropping the delta exclusion reddens cases 2 and 3; dropping the co-occurrence predicate
   reddens case 5; dropping the retraction negation reddens case 4 and nothing else.
7. `npm run check:standards` — no new errors and no new warnings against the baseline at build time.
