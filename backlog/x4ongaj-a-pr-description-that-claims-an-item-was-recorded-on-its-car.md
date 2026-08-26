---
kind: story
size: 3
parent: "3029"
status: open
relatedTo: ["3160"]
scope: ["we:scripts/check-standards-rules.mjs", "we:scripts/__tests__/check-standards-rules.test.mjs"]
dateOpened: "2026-08-25"
tags: [prevention, review, gate, pr-body]
---

# A PR description that claims an item was recorded on its card, when the diff never touched it

A PR body can say an item was prepared or recorded on its card while the PR's changed files contain no `backlog/<id>-*.md` for that id. The claim reads as durable when it lives only in prose, and the next preparer skips the item as done. Owed by a CONFIRMED finding on PR #1556, whose body said #3160 now carried the operation's contract on the card after a later round had pulled #3160 out of that PR. Ground truth is mechanical: ids claimed versus ids touched.

## Why a gate rather than a review habit

The finding was caught, but only because a juror re-derived the PR's net changed-file list and opened
`#3160` on `main`. Nothing in the pipeline compares the two. Both halves are already available without
judgment: the claimed ids are `#<digits>` tokens in the body near a claim verb, and the touched ids are the
`backlog/<id>-*.md` paths in the diff. A body that claims an id it never touched is a **fact** about two
lists, not an opinion about wording — which is exactly the shape `#2963`'s hookable-vs-judgment split says
belongs in a script.

## What it must not do

**It must not flag every id a body mentions.** A body legitimately cites related items, blockers, parents and
prior art without touching them, and a check that flagged those would fire on nearly every PR and be turned
off within a week. Only a mention carrying a **claim verb** — *prepared*, *recorded*, *stamped*, *updated on
the card*, *now carries* — is in scope. Getting that predicate narrow enough is the actual work of this item;
the set comparison is trivial.

**It must not read `main`.** Whether the card is *good* is a review question. This asks only whether the PR
that claims to have written it, wrote it.

**It must not fire on a RETRACTION.** This is the one that would have sunk it, found by the review of the PR
that filed this card. When #1556's body was corrected, the fix did not delete the false sentence — it quoted
it, in order to say it was wrong:

> *## #3160 is NOT prepared by this PR — and an earlier draft of this description said it was*
>
> *Round 6 **pulled #3160 out of this PR** … The description did not follow, and kept claiming "#3160 now
> carries the operation's contract, recorded verbatim on the card." An independent review checked the ground
> truth and found the opposite: the net diff touches no `backlog/3160-*.md` file …*

The claim string is still present, still next to a claim verb, still with no `backlog/3160-*.md` in the diff.
A rule that only pattern-matches would flag the **corrected** body — a false positive on its own motivating
case, and worse, one that punishes the honest fix and rewards silently deleting the error instead. So the
predicate must be negated by a nearby retraction marker (*an earlier draft*, *was wrong*, *not prepared by
this PR*, a blockquote), and case 4 below exists to hold that.

## Interfaces

A rule in `we:scripts/check-standards-rules.mjs` taking `{ body, changedFiles }` and returning findings, so it
is pure and testable without a network call. Wiring it to a PR context is the caller's job.

## Done when

1. **Executable** — a case where a body says *"#3160 now carries the operation's contract, recorded verbatim
   on the card"* and `changedFiles` contains only `backlog/3233-*.md`, `backlog/3230-*.md`,
   `backlog/3238-*.md` returns exactly one finding naming `3160`. That is PR #1556's real input **as it
   stood when the finding was raised** — the three-file set an independent review re-derived on 2026-08-25.

   *(Retracted, not deleted. An earlier version of this criterion said flatly "That is PR #1556's real
   input", with no date. **That is no longer true and the sentence needed the qualifier from the start.**
   #1556 kept taking rounds after the finding and merged on 2026-08-26 carrying **13** changed files, not
   three — `agent-memory-src/` entries plus `backlog/` `3118`, `3165`, `3230`, `3233`, `3238`, `3273`,
   `3277`–`3281`. A reader who runs `gh pr view 1556 --json files` today gets 13 paths and cannot reproduce
   this criterion's input. What has **not** changed, and is the part the criterion actually rests on, is that
   no `backlog/3160-*.md` is in that set — not in the three-file version, not in the merged 13-file version.
   The finding stands; only its snapshot needed dating.)*
2. **Executable** — the same body with `backlog/3160-*.md` added to `changedFiles` returns none. This is a
   **constructed** variant, not a replay: #1556's real correction changed the *body* and never touched its
   file set, so no such input ever existed. An earlier draft of this criterion called it "its corrected
   input", which was false and mattered — believing the replay existed is what hid criterion 4 below.
3. **Executable** — a body that merely cites ids without a claim verb (`relatedTo`-style prose, *"blocked by
   #3165"*, *"see #2678"*) returns none, so the rule does not fire on ordinary cross-references.
4. **Executable** — **#1556's ACTUAL corrected body returns none.** It still contains the claim string, still
   beside claim verbs, still with no `backlog/3160-*.md` in the diff — because the correction *quotes* the
   false sentence to retract it. A rule that flags this is a rule that penalises the honest fix. This is the
   one case that must be taken from the real PR rather than constructed.
5. **Mutation** — dropping the claim-verb predicate reddens case 3 by name; dropping the set comparison
   reddens case 1; dropping the retraction negation reddens case 4 **and nothing else**.
6. `npm run check:standards` — no new errors and no new warnings against the baseline at build time.
