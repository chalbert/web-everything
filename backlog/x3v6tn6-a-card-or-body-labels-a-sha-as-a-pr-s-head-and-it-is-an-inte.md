---
kind: story
size: 3
parent: "3029"
status: open
relatedTo: ["3233", "3238"]
scope: ["we:scripts/check-standards-rules.mjs", "we:scripts/__tests__/check-standards-rules.test.mjs"]
dateOpened: "2026-08-25"
tags: [prevention, gate, backlog, citation]
---

# A card or body labels a sha as a PR's head, and it is an intermediate commit on that branch

A card or PR body can pin a fixture to a sha and label it "PR #N's head". When the sha is an intermediate commit — a prep round, a rebase — the label is wrong even though the pin is right, and a builder who resolves the label instead of the sha measures a different tree. Acceptance criteria can invert there. Owed by a CONFIRMED finding on PR #1563, where `ee6e5a98` was called #1556's head in two cards and the body while the real head was `74c1c9f0`. Ground truth is mechanical: the PR's headRefOid.

## Why a wrong label is not cosmetic

The pin and the label point at different trees, and a builder will follow whichever one they can resolve. A
sha is opaque; *"#1556's head"* is a lookup. On the motivating case the lookup **inverts two acceptance
criteria**:

- `xo5pueh` criterion 1 asks that `#3238`'s Done-when 7 and `#3230`'s Done-when 6 each report **one** finding
  for hard-coding a warning total. At `ee6e5a98` both carry the bare literal, so they do. At the real head
  `74c1c9f0` both had already been rewritten into the delta form, and the literal survives only inside a
  retraction — which that same card's *"must not fire on a RETRACTION"* negation says must report **none**.
  Resolving the label gets the **opposite** of the stated expectation, and the builder concludes their rule
  is broken.
- `xv92hju` criterion 3 says `#3233` cites two facts correctly at `:274` and `:279`. At `ee6e5a98` it does.
  At `74c1c9f0` those lines are **279** and **284**, because later prep rounds inserted text above them.

Both fixtures reproduce at the pinned sha. Only the label is wrong — which is why a reader who trusts it
cannot tell the fixture is fine.

## Why a gate rather than a careful author

This is the same failure `x4dbhiy` already retracts once, in the same PR: *"`5289202` was an intermediate
rebase commit, not the head that merged"*. The *same* error, with a different sha, stood in two other cards
and in the description, and correcting the first one did not surface any of them. An author who has just
fixed the error in one place is demonstrably not the mechanism that finds the next three.

`xfgjxyf` — the card filed for *"corrected here, left standing there"* — is adjacent and does not cover it.
That rule keys on the **corrected claim's own string**, which is how it hands a searcher the text to look
for. `5289202` and `ee6e5a98` share no string, so the second instance carries nothing for it to match. The
class is the wrong sha in the same **role**, and only resolving the role finds it.

**A third pair stood while this card was being filed, and the review caught it rather than the author.** The
round that corrected `ee6e5a98` in all three of its places left `60acbe5f` labelled *"PR #1556's merge-base"*
two lines above the paragraph it was editing — `x4dbhiy` twice and the description once. `60acbe5f` is a
`drain` commit on `main`:
`baseRefOid` is `e9aa38f6`, the merge-base at the merged head is `e6db8cf5`, and at the pre-rebase head
`e7ab2833`. It is none of the three. That instance is the reason the role-word list below is not just *head*
— an author fixing one role word does not think to re-resolve a different one, and a rule that resolves the
role finds both without being told which word to worry about.

**The round that corrected that one missed a fourth, on the same sha, in the same file.** `x4dbhiy`'s
marker-set fence was labelled `base 60acbe5f` / `head 74c1c9f0` until round 8. `head` was right; `base` was
not — `baseRefOid` resolves to `e9aa38f6`. Round 6 swept for *head*, round 7 swept for *merge-base*, and
**both swept prose**: the third role word sat inside a fenced result block and neither
grep for a quoted word reached it. Three consecutive rounds each fixed the instance a review quoted and left
the next one standing a few lines away — at `87d5823d` the untouched `base` label sat six lines below the
`merge-base` label round 7 rewrote.

Counted under this card's own predicate — a sha sitting beside a role word for a **named** PR — one PR
produced four pairs across **nine** places: `5289202` as *head* in `x4dbhiy` and the description (2),
`ee6e5a98` as *head* in `xv92hju`, `xo5pueh` and the description (3), `60acbe5f` as *merge-base* in
`x4dbhiy` twice and the description (3), and `60acbe5f` as *base* in `x4dbhiy`'s fence (1).
2 + 3 + 3 + 1 = 9. **Not one of the four was caught by an author** — each was found by a later review.
That is the case for a gate rather than a more careful author.

*(Retracted, not deleted. This paragraph, written in round 7 (`1090ac22`) together with the same count in
the PR description, said* **three** *pairs across* **eight** *places.* ***That undercounted by one pair and
one place***, *and it undercounted in the direction the card is about: the missing pair is the one no prose
grep could see. The card-side figures are re-read from git, not recalled.*
`git show 87d5823d:backlog/x4dbhiy-….md | grep -n '60acbe5f'` *returns lines* **60**, **66** *and* **110**:
*60 and 110 are the two* merge-base *places — 110 holds the sha and its role word ends the wrapped line 109
above it — and 66 is the fenced* `base` *label. Three places on one sha in one file, and the round-7 fix
reached two of them.)*

*(Retracted, not deleted — the* **attribution**, *not the count. Until this round this card also stated*
***which commit wrote which pair***, *in two places that disagreed: the third-pair paragraph opening this
section said* `6954693e` *"corrected `5289202` and wrote* both *remaining pairs", and the sentence closing
the count above said* three *of the four "were written by the very commit that corrected the one before it".*
***Both are withdrawn.*** *They contradict each other — two and three cannot both be right — and re-reading
the history supports neither cleanly:* `ee6e5a98` *enters at* `95b5585a` *and is touched again at* `87d5823d`
*and* `1090ac22`; `60acbe5f` *appears across four commits, two of them from other PRs.* `git log -S` *counts*
**removals** *as well as additions, which is why two careful readings of the same command disagreed.
Per-commit attribution is not resolvable here at reasonable cost, and nothing depends on it: the argument for
a gate needs only* **four wrong (sha, role) pairs across nine places, none of them caught by an author** —
*verified, uncontested, and already the basis of every Done-when. The pair inventory and the 2 + 3 + 3 + 1 = 9
arithmetic are unchanged.)*

(Anaphoric back-references — `xo5pueh`'s round-5 *"at the same head"*, twice — are not counted here: they
carry no sha, so the predicate does not reach them. They still have to move when the label they point at
moves, which is a reason the finding is reported against the label rather than each mention.)

`xv92hju` is adjacent too, and also does not cover it. That rule reads a cited **line** and looks for a quoted token;
here the citation is a **sha** and a role, the token is fine, and the file is not the thing being cited. A
different sha with the same shape passes `xv92hju` untouched.

## What it must not do

**It must not resolve the PR itself.** Whether `#N`'s head is `<sha>` is a `gh` call and a network round
trip. The rule takes the assertions it extracted and a resolver the caller supplies, so it stays pure and
testable. For a **merged** PR the answer is the merge commit's second parent, which is why the resolver —
not the rule — owns that branch.

**It must not flag a sha that is merely named.** *"measured at `60acbe5f`"*, *"landed in `14cd7c60`"*, a sha
appearing as an **argument** in a fenced command are orientation, not a claim about a role. Only a sha
carrying a **role word** for a named PR — *head*, *tip*, *merge commit*, *base*, *merge-base* — is in scope.
The role word is the predicate, not the hex.

**Being inside a fence is not itself a defence.** The scope above is the role word, so a fenced *label* — a
role word standing beside a sha in a result block, as `x4dbhiy`'s `base 60acbe5f` did — is in scope, while a
fenced *command* that merely passes the sha to `git` or `gh` is not. That distinction is the whole reason
the fourth pair survived two rounds of grepping: it was a role word a reader reads as a claim and a grep for
prose skipped as code.

**It must not demand the pin change.** The fix for the motivating case was to correct the **label** and keep
the sha, because the fixture was right. A rule that pushed the author toward re-pinning to the real head
would have broken two working fixtures.

**It must not fire on a RETRACTION.** This card quotes *"#1556's head `ee6e5a98`"* in order to say it was
wrong, and `x4dbhiy` quotes *"#1556's head (`5289202`)"* for the same reason. The same negation `x4ongaj`
criterion 4, `xv92hju` criterion 4 and `xo5pueh` criterion 4 all need.

## Interfaces

A pure function in `we:scripts/check-standards-rules.mjs` taking `{ assertions, resolveRole }` and returning
findings, where an assertion is `{ pr, sha, role, retracted }` extracted from the body. Extraction is part of
this item; resolving `#N` + role to a sha is the caller's.

## Done when

1. **Executable** — `xo5pueh`'s round-5 text *"`#3233`'s Done-when 8, at PR #1556's head `ee6e5a98`"* against
   a resolver that answers `74c1c9f0` for `{pr: 1556, role: 'head'}` reports exactly one finding, and the
   finding names `74c1c9f0` as the sha that does hold the role. Real input, from this card's own PR.
2. **Executable** — the same sentence with the label corrected — the sha kept, described as an intermediate
   commit rather than the head — reports none. The pin was never the defect.
3. **Executable** — a sha named with no role word (*"measured at `60acbe5f`"*, a sha inside a fenced
   command) reports none, so the rule does not fire on ordinary pinning.
4. **Executable** — **this card's own body reports none**, and so do `x4dbhiy`'s corrected retractions.
   Both files still carry a sha beside *"#1556's head"* and beside `base`, because both quote the wrong
   labels in order to retract them. Taken from the real files, not constructed.
5. **Executable** — a **second role word**, on real input, at the head this card was filed from:
   `x4dbhiy`'s round-6 line 60, *"at PR #1556's **merge-base** `60acbe5f` and at its **merged head**
   `74c1c9f0`"*, against a resolver answering `e6db8cf5` for `{pr: 1556, role: 'merge-base'}` and `74c1c9f0`
   for `{pr: 1556, role: 'head'}`, reports **exactly one** finding — on the `merge-base` half, not the
   `head` half, which is correct in the same sentence. This is the instance the round-7 review caught: it
   sits **outside** the retraction that case 4 covers, so case 4 alone does not reach it. Its corrected form
   — *"at `60acbe5f`, a `main` commit predating PR #1556's merge"* — reports none, because no role word is
   claimed for the PR.
6. **Executable** — a **third role word, inside a fence**, on real input: `x4dbhiy`'s round-7 marker-set
   block, whose two label lines read `base 60acbe5f` and `head 74c1c9f0` under a paragraph naming PR #1556,
   against a resolver answering `e9aa38f6` for `{pr: 1556, role: 'base'}` and `74c1c9f0` for
   `{pr: 1556, role: 'head'}`, reports **exactly one** finding — on the `base` line, not the `head` line,
   which is correct. Its round-8 corrected form, the same block with the sides labelled `60acbe5f (pre-merge
   main)` and `74c1c9f0 (#1556's head)`, reports **none**: the surviving role claim resolves true and the
   other side no longer claims a role. This is the case that says a fenced label is a claim — cases 1 and 5
   are both prose, so a rule that skipped fenced text would stay green on every other case here and still
   miss this one.
7. **Mutation** — dropping the role-word predicate reddens case 3 by name; hard-coding the role word to
   *head* reddens case 5 and nothing else; hard-coding it to *head* **or** *merge-base* reddens case 6 and
   nothing else; skipping fenced text reddens case 6 and nothing else; dropping the retraction negation
   reddens case 4 and nothing else; comparing on the *label text* instead of the resolved sha reddens case 1,
   where the sha is a real commit on the right branch.
8. `npm run check:standards` — no new errors and no new warnings against the baseline at build time.
