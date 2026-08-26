---
kind: story
size: 3
parent: "3029"
status: open
relatedTo: ["3233"]
scaffoldedBy: "conv-1563"
dateScaffolded: "2026-08-25"
scope: ["we:scripts/check-standards-rules.mjs", "we:scripts/__tests__/check-standards-rules.test.mjs"]
dateOpened: "2026-08-25"
tags: [prevention, gate, backlog, citation]
---

# A backlog card cites a path:line, and the cited line no longer contains the token it quotes

A backlog card can cite `path:line` beside a quoted snippet, and the line drifts as the file moves beneath it, so a reader who jumps to the citation lands on the wrong statement. Both halves already live on the card: the path, the line, and the token it quotes. Owed by two CONFIRMED findings on PR #1556, where `#3233` cited `:455` and `:487` for statements at 456 and 486, and by a third on PR #1563 itself, whose `x4dbhiy` cited `we:scripts/check-standards-rules.mjs:812` for a statement at 814. Ground truth is mechanical: read the cited line, look for the token.

## Why a gate rather than a careful author

Three CONFIRMED instances in two PRs, all from authors who were checking their work, and one of them in the
PR filing the prevention cards. Each was caught by a reviewer opening the file and counting — which is exactly
the work a script does without getting tired.

The failure is not laziness about the number; it is that **a citation is verified once and then never
re-verified**, while the file it points into keeps moving. Two of the three even cite the *same fact*
correctly elsewhere in the same card: `#3233` writes `:455`/`:487` in its Interfaces section and `:456`/`:486`
in its Tasks section, four sections apart. Nothing compares them, because nothing reads either.

**One correction to the record.** The review that raised this on PR #1563 called `x4dbhiy`'s `:812` a
*"locator drift (main moved between when the card was authored and when it was measured here)"*. That is
wrong, and the difference matters for what this card must do. Walking **all 81** commits that have touched
`we:scripts/check-standards-rules.mjs`, `const markers = [...new Set(markerHits…` reached line **814** at
`5da6b548` (2026-08-15) and has been there in every commit since — ten days before the card was authored on
2026-08-25 — and **812 never held it in any of the 81**. The citation was never correct on any tree the
author could have measured. So the check must **verify against the tree it runs on** rather than trying to
date the drift — a wrong citation and a drifted citation are the same finding, and the cheap check catches
both.

*(Retracted, not deleted. An earlier version of this paragraph said the statement had been at 814 "since
`d898a879`", from a walk of "the last 15 commits". **Both were wrong.** `d898a879` is four commits after
`5da6b548` and inherited 814 rather than establishing it, and a 15-commit sample cannot support a claim
about when a line settled. The corrected figures above are from the full 81-commit walk. That this card's
own motivating paragraph carried a wrong commit citation, through two rounds of review, is the argument for
the card.)*

## What it must not do

**It must not require every citation to quote something.** A card names a file, or a file and a line, as an
orientation pointer far more often than it quotes from it. Only a citation with a nearby quoted token — a
blockquote, an inline code span, a fenced line — is checkable. Everything else is out of the denominator,
not a finding.

**It must not fire on a RETRACTION.** This is the same negation `x4ongaj` criterion 4 needs, and this card's
own motivating fix commits the pattern immediately: correcting `x4dbhiy` means **quoting `:812` in order to
say it was wrong**, so the corrected card contains a citation whose line does not hold the token *by design*.
A rule that flags the corrected card punishes the honest fix and rewards deleting the error silently. The
predicate must be negated by a nearby retraction marker, and criterion 4 below is taken from the real
corrected file rather than constructed.

**It must not resolve the path itself, or read git.** Whether the file exists at all is a different check;
whether the line held the token *last week* is not a question this asks. Given a path, a line, a token and
the file's current contents, the answer is a fact.

**It must not demand an exact string match.** The card wraps quoted code to fit the column limit and drops
trailing punctuation. Compare on collapsed whitespace, and match a prefix of the quoted token rather than the
whole of it — otherwise the check fires on formatting and gets switched off.

## Interfaces

A pure function in `we:scripts/check-standards-rules.mjs` taking `{ citations, readFileLines }` and returning
findings, where a citation is `{ path, line, token, retracted }` extracted from the card body. Extraction is
part of this item; resolving `we:` prefixes to real paths is the caller's, so the rule stays testable without
a filesystem.

## Done when

1. **Executable** — `x4dbhiy`'s pre-fix citation — path `we:scripts/check-standards-rules.mjs`, line 812,
   token `const markers = [...new Set(markerHits.map((h) => h.marker))]` — against the live file reports
   exactly one finding, and the finding names **814** as the line that does hold the token. Real input, from
   this card's own PR.
2. **Executable** — the same citation with the line corrected to 814 reports none.
3. **Executable** — `#3233` at `ee6e5a98`, whose `:137` cites
   `we:scripts/operations/review-prep.mjs:455` for `reads: ['findings.read', 'findings.judge']` (live line
   456) and whose `:142` cites `:487` for the `record` step's `reads` (live line 486), reports **two**
   findings — and reports them even though the same card cites both facts correctly at `:274` and `:279`. A
   correct citation elsewhere is not a defence; this is the case that says so. `ee6e5a98` is an intermediate
   commit on #1556's branch, not its head — pin the sha, do not resolve the PR.

   *(Retracted, not deleted. An earlier version of this criterion called `ee6e5a98` **"PR #1556's head"**.
   **That was wrong.** `gh pr view 1556 --json headRefOid` returns `74c1c9f0`, merged as `14cd7c60`;
   `ee6e5a98` is the intermediate `prep r7` commit, superseded by `6250a0a2` (`prep r9`) before this card was
   authored. The **pin is right and stays** — the fixture reproduces at `ee6e5a98`, verified — but the label
   moves the correct-citation half: at `74c1c9f0` those two lines are **279** and **284**, not 274 and 279,
   because later prep rounds inserted text above them. This is the same error `x4dbhiy` retracts one round
   earlier over `5289202` — corrected there, written into this card in the same commit. It is the `xfgjxyf`
   shape but not something `xfgjxyf` catches: that rule matches on the corrected claim's own string, and a
   different sha carries none of it. `x3v6tn6` is filed for the head-label class itself, owed by the review
   that caught this.)*
4. **Executable** — **`x4dbhiy`'s ACTUAL corrected body reports none.** It still contains the string
   `we:scripts/check-standards-rules.mjs:812` beside the quoted token, because the fix quotes the wrong
   citation to retract it. Taken from the real file, not constructed — the same requirement `x4ongaj`
   criterion 4 sets.
5. **Executable** — a citation with no quoted token nearby reports none, and a `path:line-line` range whose
   quoted token falls anywhere inside the range reports none.
6. **Mutation** — dropping the retraction negation reddens case 4 and nothing else; requiring an exact
   (uncollapsed) string match reddens case 3, where the quoted arrays are wrapped in the card.
7. `npm run check:standards` — no new errors and no new warnings against the baseline at build time.
