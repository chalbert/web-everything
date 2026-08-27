---
bornAs: xgytlo1
kind: story
size: 3
parent: "3318"
status: open
scope: ["we:scripts/review-corpus/gates.mjs"]
dateOpened: "2026-08-26"
tags: []
---

# A card's mechanism claim must cite the function or line that backs it

A card that asserts "component X does Y by mechanism Z" and cites nothing costs a build round when Z turns out to be wrong: the builder greps for Z, finds the opposite, and either resolves the card as already-fixed or hardens an already-hardened path. Require the citation, and gate what can be gated.

## Where this came from

The OWED prevention on the confirmed correctness finding against
[#1596](https://github.com/chalbert/web-everything/pull/1596). The `3343` card in that PR opened with

> pr-land derives the review label from GitHub's three-dot file list

and concluded that *"the producer-side label derivation in `we:scripts/pr-land.mjs` did not get the same
treatment"* as the review side. Both false, and the second exactly backwards: `we:scripts/pr-land.mjs:839`
scores off a local `computeNetDiffSignals(...)`, and `resolveNetDiffBasis`
(`we:scripts/merge-ai-prs.mjs:2060`) has narrowed the diff to `merge-base(origin/main, head)` since #2404,
with a named regression test. The symptom the card described was real; the mechanism was invented.

Neither the card's author nor its first reviewer caught it. It took a reviewer who went and read
`we:scripts/pr-land.mjs`. **That reading is the whole check**, and today nothing asks for it.

## What is gateable and what is not

The juror's own framing was that no deterministic gate can verify a card's causal narrative against source,
so the guard has to be a review convention. That is right about the *narrative* and too pessimistic about the
*shape*. Two separable pieces:

**Gateable — an uncited mechanism claim.** `citation-line-content`
(`we:scripts/review-corpus/gates.mjs:406`) already checks that a `file:line` citation is consistent with the
identifiers named around it. It only fires on citations that **exist**. The complementary detector is the
missing one: a sentence that asserts a named repo module *does* something — "`X` derives / computes / reads /
calls …" where `X` resolves to a real file in `scope:` or in the body — and carries no `file:line`, no
function name, and no quoted source. That is a text shape, checkable without judgment.

**Not gateable — whether the cited line actually says what the sentence claims.** That stays a review
convention: whoever files or reviews a card checks the citation before the card is scoped to a fix. Write the
convention down where reviewers will meet it rather than leaving it as folklore.

The split matters because a gate that tried to judge the narrative would be exactly the failure the sibling
card `3340` describes — a detector whose real aperture is invisible from its name.

## Prior art in this PR

The retraction convention (quote the wrong sentence, then correct it) is already the repo's practice. This
item is about making the first half — the citation itself — checkable rather than remembered.

**And #1596 is its own best evidence that remembering does not work.** An earlier version of this section
said:

> All three cards `#1596` revised this round now carry `file:line` citations for every mechanism claim

That was written while a fourth card in the same PR, `3344`, carried **zero** citations — it asserted the
lens vocabulary and the "`--lens` substitutes rather than adds" behaviour on bare assertion. Counted, not
recalled: `grep -coE 'we:[A-Za-z0-9_./-]+\.mjs:[0-9]+'` returned `0` for that card and `1`/`4`/`5`/`11` for
the other four. A round-3 pass raised it to `7`. Nobody was being careless: the claim was true of the cards
that had been *revised* and silently generalised to the ones that had not. A gate would not have generalised.

## The scores, recorded (Done-when 2)

**Against the mined corpus.** `node we:scripts/review-corpus/replay-gates.mjs --gate=uncited-mechanism-claim`
over 92 cases / 39 confirmed labels: **0 labels caught, 6 fires with no matching label.**

The 0 is not a miss rate. **None of the 39 confirmed labels is an instance of this class** — the class was
first named on PR #1596, which is later than every case in `we:scripts/review-corpus/cases`. So the file
header's *">=80% of its own labelled class"* term is 0/0, undefined rather than failed. Recorded here
rather than rounded away, because a 0 that means "no specimen" and a 0 that means "missed them all" are
the same number and opposite facts.

The 6 extras were adjudicated one by one and **all 6 are real uncited mechanism claims** — two of them the
same card (`3182`/`xvpy20j`) at two revisions. The header's other term, *"fires zero times where no
reviewer found anything"*, would forbid any gate that finds what reviewers missed, which is the thing
`we:scripts/review-corpus/replay-gates.mjs` itself says an extra may be: *"either a false positive or a
real defect nobody looked for … a number to ADJUDICATE, never a number to divide by."* Adjudicated, not
divided by.

**Against the live board.** Swept over all 3336 files in `we:backlog/`: **17 findings on 17 cards (0.5%).**
Own judgement on all 17: **13 true, 3 false, 1 arguable.** The three false ones are subject-attachment
misreads (*"the path in `X` resolves"*, where the path resolves and `X` does not) and a design proposal
written in the present tense (*"a pure `X` parses …"* for a script the card is asking for). None is
fixable without a predicate that would cost more than it saves.

The gate is a CANDIDATE, scored by the replay harness — `we:scripts/review-corpus/gates.mjs` has no
consumer in `check:standards`, so this adds 0 to its warning count.

## Done when

1. **Executable** — a new gate in `we:scripts/review-corpus/gates.mjs`, registered in `GATES`, reports the
   `3343` card's original opening sentence (quoted above, naming `pr-land` with no citation) and reports
   nothing on the revised card, which cites `we:scripts/pr-land.mjs:839`. Run through `runGates(text, { path,
   read })` — the registry's real calling convention — so the gate is exercised as it will be in production.
2. The replay harness (`we:scripts/review-corpus/replay-gates.mjs`) scores the new gate against the recorded
   corpus, and the score is recorded on this card: a detector that fires on most existing cards is a warning,
   not a hard failure, and that decision is part of the work rather than an afterthought.
3. `npm run check:standards` — 0 errors.
