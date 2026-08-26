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
rebase commit, not the head that merged"*. The commit that made that correction wrote the *same* error, with
a different sha, into two other cards and into the description. An author who has just fixed the error in one
place is demonstrably not the mechanism that finds the next three.

`xfgjxyf` — the card filed for *"corrected here, left standing there"* — is adjacent and does not cover it.
That rule keys on the **corrected claim's own string**, which is how it hands a searcher the text to look
for. `5289202` and `ee6e5a98` share no string, so the second instance carries nothing for it to match. The
class is the wrong sha in the same **role**, and only resolving the role finds it.

`xv92hju` is adjacent too, and also does not cover it. That rule reads a cited **line** and looks for a quoted token;
here the citation is a **sha** and a role, the token is fine, and the file is not the thing being cited. A
different sha with the same shape passes `xv92hju` untouched.

## What it must not do

**It must not resolve the PR itself.** Whether `#N`'s head is `<sha>` is a `gh` call and a network round
trip. The rule takes the assertions it extracted and a resolver the caller supplies, so it stays pure and
testable. For a **merged** PR the answer is the merge commit's second parent, which is why the resolver —
not the rule — owns that branch.

**It must not flag a sha that is merely named.** *"measured at `60acbe5f`"*, *"landed in `14cd7c60`"*, a sha
in a fenced command are orientation, not a claim about a role. Only a sha carrying a **role word** for a
named PR — *head*, *tip*, *merge commit*, *base*, *merge-base* — is in scope. The role word is the
predicate, not the hex.

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
4. **Executable** — **this card's own body reports none**, and so does `x4dbhiy`'s corrected retraction.
   Both still contain a sha beside *"#1556's head"*, because both quote the wrong label to retract it. Taken
   from the real files, not constructed.
5. **Mutation** — dropping the role-word predicate reddens case 3 by name; dropping the retraction negation
   reddens case 4 and nothing else; comparing on the *label text* instead of the resolved sha reddens
   case 1, where the sha is a real commit on the right branch.
6. `npm run check:standards` — no new errors and no new warnings against the baseline at build time.
