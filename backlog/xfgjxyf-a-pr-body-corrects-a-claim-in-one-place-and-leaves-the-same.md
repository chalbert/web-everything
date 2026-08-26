---
kind: story
size: 2
parent: "3029"
status: open
relatedTo: ["3035"]
scope: ["we:scripts/check-standards-rules.mjs", "we:scripts/__tests__/check-standards-rules.test.mjs"]
dateOpened: "2026-08-25"
tags: [prevention, review, gate, pr-body]
---

# A PR body corrects a claim in one place and leaves the same claim standing in another

A PR body carrying a self-correction — *an earlier version said X; it was not* — can still assert X verbatim elsewhere in the same body, with no retraction near it. The reader hits the false sentence first and the correction never. It is string work over one document: no diff, no network, no judgment about whether the correction is right, only whether it was applied everywhere. Prevention owed by a CONFIRMED finding on PR #1563, whose body both asserted a fixture's provenance and, thirty lines later, denied it.

## Why the correction is what makes it findable

An uncorrected false claim needs a reviewer who knows the ground truth. A *half*-corrected one carries its own
evidence: the body contains both the claim and, elsewhere, an explicit statement that the claim is false. The
document contradicts itself, and a contradiction between two strings in one file is a fact, not an opinion
about wording — which is the test for what belongs in a script rather than in a reviewer's attention.

The correction sentence also hands over the quoted claim for free. Bodies in this repo retract by quoting —
that convention is `x4ongaj`'s criterion 4 — so the retraction *contains* the text to search for. There is
nothing to infer.

## What it must not do

**It must not fire on the retraction itself.** The correction quotes the claim; that occurrence is the
correction, not a survival of it. Only occurrences outside the retraction's own neighbourhood count. This is
the same negation `x4ongaj` needs, applied to a different document, and getting it wrong turns the check into
a penalty on the honest fix.

**It must not try to decide whether the correction is correct.** Whether the new claim is true is a review
question. This asks only whether the old one is still standing unmarked.

**It must not demand deletion.** Marking the stale sentence retracted is an equally valid fix, and on this
repo's convention it is the *preferred* one — the rule is quote-and-retract, never silent delete. So a stale
occurrence carrying its own retraction marker is clean.

**It must not be mistaken for a check on the underlying claim.** Keying on the corrected claim's own string
is what makes this rule free of judgment, and it is also its boundary: a body that fixes one instance of an
error and commits the *same kind* of error with different text elsewhere passes clean. That happened inside
this card's own PR — `x4dbhiy`'s *"#1556's head (`5289202`)"* was corrected while *"#1556's head
`ee6e5a98`"* stood in two sibling cards, and the two share no string. `x3v6tn6` is filed for that class.
*(Retracted, not deleted: this sentence used to say the correction was made* **in the very commit that
wrote** *the second label. That per-commit attribution is withdrawn in full on* `x3v6tn6` — `git log -S`
*counts removals as well as additions and cannot settle it. The two labels, and the fact that they share no
string, are all this negation needs and are unchanged.)* Widening this rule to catch it would mean asking
what a claim *means*, which is the line this card exists on the safe side of.

## Interfaces

A pure function in `we:scripts/check-standards-rules.mjs` taking a body string and returning findings, with
the retraction-marker vocabulary shared with `x4ongaj` rather than copied. Two copies of that phrase list
drifting apart would make one rule fire where the other negates.

## Done when

1. **Executable** — a body containing a correction and, elsewhere, the corrected claim verbatim with nothing
   retracting it, reports exactly one finding naming both line numbers. The fixture is PR #1563's own round-2
   body, whose two sentences are reproduced here so the case does not depend on retrieving a body that has
   since been rewritten:

   ```text
   [assertion]  Its first two acceptance cases are PR #1556's real input and its corrected input, so the
                fixture is the actual defect rather than a constructed one.

   [correction] Its criterion 2 claimed to be "#1556's corrected input." It was not: #1556's correction
                changed the body and never touched its file set, so that replay never existed. It is now
                labelled constructed …
   ```
2. **Executable** — the same body with the stale occurrence marked retracted reports none. That is this PR's
   own fix, so the two cases are one body either side of it.
3. **Executable** — the same body with the stale occurrence deleted reports none.
4. **Executable** — a body with a correction whose claim appears nowhere else reports none, and a body with a
   repeated claim and no correction at all reports none. The check is about the *pair*, not about either half.
5. **Mutation** — dropping the "outside the retraction's neighbourhood" restriction reddens case 4's first
   half by firing on the retraction's own quotation; dropping the retraction-marker negation reddens case 2.
6. `npm run check:standards` — no new errors and no new warnings against the baseline at build time.
