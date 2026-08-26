---
kind: story
size: 2
status: open
relatedTo: ["3147", "3035"]
dateOpened: "2026-08-25"
tags: [operations, review, pr-transport, prevention]
---

# A PR body's frontmatter claims are never checked against the diff it describes

Gate every backticked `key: value` span in a PR body against the value the PR's own diff writes, so a stale description cannot survive a review round.

## The observation this is filed from

PR #1560 (preparing #3147) was bounced four consecutive rounds, and two of those bounces were the same
defect: **the description asserted something the diff did not do.** Both are historical — both were resolved
in the round-5 push that filed this item; the rows below name the commit each claim stood at, not the head.

| bounce that found it | the body said | the diff wrote, at that commit |
| --- | --- | --- |
| r3 bounce | `scope:` gains `we:skills-src/conveyor/runner.mjs` | `3374b1db` — `scope:` is `we:skills-src/conveyor/SKILL.md` alone |
| r4 bounce | this card is now `blockedBy: ["3165"]` | `12db3256` — `blockedBy: ["3118", "3165"]` |

Both are the *same shape*: a backticked `key: value` span in the body, naming a real backlog frontmatter key,
quoting a value the diff contradicts. The r4 bounce is the sharpest evidence that a human pass does not catch
this — the body **was** edited at `12db3256`, to fix the `scope:` instance, and the `blockedBy` sentence three
paragraphs above it was not re-read. The `blockedBy` claim then survived a further round untouched: it entered
the frontmatter at `e14e41dd` (r2) and was still disagreeing with the body at `12db3256` (r4), three review
passes later. Both instances are mechanically detectable from data the transport already has.

## Why a gate rather than a rule

A rule ("re-read the body against the diff") already exists in every fix-agent brief and has now failed four
times on one PR. The check is cheap and total where a re-read is neither: the body is one `gh pr view --json
body` call, the diff is one `git diff`, and backlog frontmatter is already parsed by
`we:scripts/check-backlog-item.mjs` and the whole-repo gate. Nothing here needs judgment.

## Sketch

For each fenced-or-backticked span in the PR body matching `<key>: <value>` where `<key>` is a known backlog
frontmatter key (`blockedBy`, `scope`, `status`, `kind`, `parent`, `relatedTo`, `size`, `tier`, …):

- **bind the span to one item.** The sentence carrying it must resolve to exactly one backlog item — by
  naming it (`#3147`, or its born-as hash) or by a self-reference (*"this card"*, *"this item"*, *"the
  card"*), which resolves to the item the PR is about. Skip the span when the bound item is one the diff does
  **not** touch, and skip it when nothing binds it.
  - **Precedence, when a sentence carries both.** A self-reference **wins** over a named item in the same
    sentence: the span is bound to the item the PR is about. *"…#3165 carries it, and this card is
    `` `blockedBy: ["3165"]` ``"* binds to #3147, not #3165, because the span sits on the self-reference's
    side of the sentence and #3165 is named as the subject of a different clause. Stated because this card's
    own *Done when* 1 fixture is exactly that sentence: read the other way — "two referents ⇒ skip" — the red
    side compares 0 spans and exits 0, and the criterion's stated numbers do not reproduce.
  - Two **named** items in one sentence and no self-reference is still a skip, reported as unchecked.
- **skip retractions.** Skip the span when its sentence carries a retraction marker — a closed, greppable
  list: `an earlier draft`, `was wrong`, `is retracted`, `superseded`, `said`, `stood at`, `from round`,
  `no longer`, `used to`, `previously`.
- otherwise read that key's value on the bound item at the PR head, and fail when the two differ, printing
  both.

**Both filters are load-bearing, not tidiness.** This repo's convention is to retract in place, quoting the
superseded value verbatim; without the retraction filter the check fires hardest on exactly the bodies that
followed the convention. And a body routinely quotes a frontmatter value belonging to a *different* item
(*"#3118 is `kind: decision, status: open`"*) — without the binding filter that is compared against the
touched card's `kind` and reported as a disagreement.

*(An earlier draft of this Sketch — the version this card was filed with, and the one `fed61bc5` left
standing — had neither filter. It read only "find the backlog item(s) the PR's diff touches; read that key's
value at the PR head; fail when the two differ." Implemented literally and run against the fixture this
card's own Done-when 1 named as **green**, it exited **1** with two disagreements: the retraction quote
`` `blockedBy: ["3118", "3165"]` `` and the about-#3118 span `` `kind: decision, status: open` ``. The
criterion and the Sketch are both corrected here; the wrong version is quoted rather than deleted because
that is what this card's sibling `xxzs9l7` exists to enforce.)*

Silent on a body that makes no **present-tense** `key: value` claim about an item the diff touches —
including a body that quotes such keys only to retract them, and one that quotes them about other items. The
scoping cost of that silence is stated in *Not in scope*.

## Not in scope

**Two spans the filters deliberately let through unchecked**, and the cost is accepted:

- a span inside a sentence that *reads* like a retraction but is a live claim — the marker list is prose
  matching, so a present-tense assertion phrased with the word "said" is skipped. Cheaper than the reverse
  error, which is a hard failure on a correct body.
- a span bound to no item at all (a sentence with neither an item reference nor a self-reference). Reported
  as **unchecked**, never as agreement, so the count of skipped spans stays visible.

Prose claims that are not `key: value` spans. Those are the sibling class, filed separately as
"A claim corrected at one site while the same claim stands at another has no gate". This item deliberately
takes only the mechanically-decidable half.

Whether a quoted invocation actually produces the result it states — including the *Done when* case that sent
this card back for a round. Filed separately as "A quoted invocation ships with a result nobody re-ran".

A prose claim about a **different, explicitly named** item's current content, which the binding filter above
deliberately skips and which can go stale after this check passes, when a concurrent lane amends that item.
Filed separately as "A card's prose claim about another item's current content is never re-read when that
item is amended".

## Done when

1. **Executable, against a fixture that is entirely in git.** The body fixture is the one sentence #1560
   carried from round 1, held as a literal rather than fetched from a live PR description:

   > Per this card's own instruction the gap is filed, not absorbed: #3165 carries it, and this card is
   > `` `blockedBy: ["3165"]` ``.

   Run against #3147's card at `12db3256` it **exits 1**, comparing one span and naming `blockedBy` with both
   values (`["3165"]` in the body, `["3118", "3165"]` in the card). Run against the same card at `fed61bc5`
   — where the frontmatter is `["3165"]` — the same sentence **exits 0**.

   Both sides were run in the fix lane at `fed61bc5` before this criterion was written; neither is asserted.
   The green side is a fixture whose spans genuinely agree, not a live body that merely looked green.
2. **Mutation** — editing the fixture sentence's span to `` `blockedBy: ["3118", "3165"]` `` inverts both
   sides: green at `12db3256`, red at `fed61bc5`. The check must fail on the *disagreement*, not on the
   presence of the key.
3. **Scoping, checked separately from agreement — and also in git.** The fixture is two sentences, one of
   each skipped kind:

   > The card's frontmatter said `` `blockedBy: ["3118", "3165"]` `` from round 2 onward. And #3118 is
   > `` `kind: decision, status: open` ``.

   Against #3147's card at `fed61bc5` it compares **0** spans, skips **2** — one *retraction*, one *other
   item #3118* — and **exits 0**, printing the reason beside each skip. With both filters disabled the same
   two sentences compare 2 and fail 2, so the criterion measures the filters and not the fixture. Both runs
   were made before this was written.
4. It is wired into the same place the review transport already runs, so a bounce for this class cannot be
   reached by a body nobody re-read.
5. `npm run check:standards` — no new errors and no new warnings against the baseline at build time.
