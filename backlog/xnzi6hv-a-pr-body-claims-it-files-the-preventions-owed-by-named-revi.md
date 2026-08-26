---
kind: story
size: 3
parent: "3029"
status: open
relatedTo: ["3035"]
scope: ["we:scripts/check-standards-rules.mjs", "we:scripts/__tests__/check-standards-rules.test.mjs"]
dateOpened: "2026-08-25"
tags: [prevention, review, gate, pr-body]
---

# A PR body claims it files the preventions owed by named reviews, and one owed marker has no card

A PR body can say it files the preventions the reviews on named PRs marked `Prevention (OWED — file it)` while one of those markers has no card in the diff. The claim asserts the debt is discharged, so nobody goes looking. Both halves are greppable: the markers in the named PRs' review comments, and the `backlog/*.md` paths the diff adds. Prevention owed three times by CONFIRMED findings on PR #1563, whose body asserted closure over an owed set it undercounted every round — two of three, then three of four, then eleven markers where the streams held fourteen.

## Why this needs a check rather than more care

It has now failed **three times on the same PR**, with the author trying, and the third time the body was
counting mechanically and still came up short. The failure is not carelessness about the claim — it is that
the denominator is genuinely hard to see by eye, and moves under the counter. The markers are scattered
across every review comment on every named PR, several rounds deep, and the obvious reading ("the latest
review on each") silently drops earlier rounds. Round 1 of #1563's review counted the latest comment of each
PR and got three; round 2 counted every comment and got five; round 3 ran the grep, published the command it
ran, and reported **11** markers where the same command over the same three streams returned **14**. The
three it missed were not hidden — they were posted on #1556 at `00:23:39Z` (two) and `00:25:42Z` (one), and
round 3 was committed at `00:59:33Z`. The count was 34 minutes stale at the moment it was asserted. Every
count was carefully derived. None was the number the body's own sentence claimed.

That last round is the argument for a script rather than a better command. The author had the right command;
what the author did not have was a re-run at the moment of the claim. A gate runs the grep when the body is
read, not when it was written.

That is the signature of work that belongs in a script: a set comparison whose sets are tedious to enumerate
and trivial to enumerate mechanically. It is the review-layer sibling of `x4ongaj` — that one checks a body's
claim about a card against the diff; this one checks a body's claim about a *review* against the diff.

## What it must not do

**It must not require that every marker be filed.** A marker can dispose of itself — #1556's round-2 marker
says in its own text *"Not worth filing as a backlog item on its own"*, and a check that demanded a card for
it would be wrong. A self-disclaiming marker is out of the denominator, and recognising one is a phrase
match, not a judgment.

**It must not guess which PRs are named.** The body says which PRs its claim covers. Ids not carrying the
claim are out of scope, exactly as in `x4ongaj`.

**It must not judge whether the filed card is the RIGHT card.** Whether a card actually prevents the thing
its marker described is a review question. This asks only whether a card exists for each owed marker — the
same line `x4ongaj` draws when it refuses to read `main`.

**It must not fire when the shortfall is disclosed.** A body that says a marker is knowingly deferred, and
names where it is tracked, has not made a false claim. This is the same retraction-negation `x4ongaj`'s
criterion 4 needs, and it is the same shape: the honest fix must not be punished.

## Interfaces

A pure function in `we:scripts/check-standards-rules.mjs` taking `{ body, reviewComments, changedFiles }` and
returning findings. Fetching the comments is the caller's job, so the rule stays testable without a network
call — the same split `x4ongaj` uses.

## Done when

1. **Executable** — a body claiming it files the preventions owed by two named PRs, with five
   `Prevention (OWED — file it)` markers across those PRs' comments, one of them self-disclaiming, and three
   cards in `changedFiles`, reports exactly one shortfall. That is PR #1563 at its round-2 head — real input,
   including the self-disclaiming marker, which is why it is the case that pins the denominator.
2. **Executable** — the same input with a fourth card added reports none.
3. **Executable** — **PR #1563 at its round-3 head `bdb59f3e`**, whose body names three PRs, claims *"nothing
   owed is outstanding"*, and files six cards, against the **14** markers those three streams held when that
   commit was authored, reports **two** shortfalls — the citation-verification prevention and the
   literal-baseline prevention. Real input, and the harder one: the body was counting mechanically and
   published the command it ran. What it lacked was a re-run at the moment of the claim, which is precisely
   what a gate supplies.
4. **Executable** — a body that names the shortfall as a deliberate deferral, with a tracking id, reports
   none. Disclosure is the fix the check is trying to force; it must not then fire on it.
5. **Executable** — a body that mentions a PR without claiming to file its preventions reports none.
6. **Mutation** — dropping the self-disclaim exclusion reddens case 1 by count (two shortfalls, not one);
   dropping the deferral negation reddens case 4 and nothing else; reading only each PR's **latest** comment
   instead of its full stream reddens cases 1 and 3 — that is the exact reading round 1 made, and it under-
   counts both heads (four markers instead of fourteen at case 3's).
7. `npm run check:standards` — no new errors and no new warnings against the baseline at build time.
