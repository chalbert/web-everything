---
bornAs: x6uyq86
kind: story
size: 2
status: open
relatedTo: ["3147", "3035"]
dateOpened: "2026-08-25"
tags: [operations, review, backlog-quality, prevention]
---

# A quoted invocation ships with a result nobody re-ran

Flag any quoted invocation in a card or a PR body that states a result — and any *Done when* criterion that
names a concrete fixture and asserts an outcome without carrying the one command that reproduces it — so
neither a criterion nor a prose paragraph can ship an exit code or a count nobody ran.

*(Filed one round earlier as **"A Done-when criterion names a fixture whose stated outcome is wrong"**, and
scoped to *Done when* alone. That title and that scope are **superseded, not wrong-then**: the founding
instance below is still a *Done when* criterion, and a second instance in the same PR — see *The widening* —
is the same defect in ordinary prose. Widened rather than filed as a fourth card because the check is
identical on both sides: take the quoted command, run it, compare.)*

## The observation this is filed from

PR #1560 (preparing #3147) filed two prevention cards in its round-5 push and was bounced again in round 5's
review — on one of those cards. `fed61bc5`, whose entire subject was *"the prevention card's own table read
as present-tense — fixed"*, tightened `3287`'s *Done when* 1 to read:

> Run against a body whose spans all match — #1560 at `3644b569` and after — it exits 0.

It exits 1. Implementing that card's own *Sketch* literally and running it on the named fixture returns two
disagreements, because #1560's body quotes superseded values inside retraction sentences — the convention
this repo requires — and quotes one frontmatter value belonging to an item the diff does not touch. Run in
this lane, at that fixture:

```
$ node <3287's Sketch, implemented literally> <#1560 body> fed61bc5
FAIL  body says `blockedBy: ["3118", "3165"]`  — diff writes `["3165"]`
FAIL  body says `kind: decision, status: open`  — diff writes `story`
4 span(s) compared, 2 disagreement(s) — exit 1
```

The criterion was authored, tightened, and reviewed without once being run against the fixture it names.

## The widening — the same defect outside a *Done when*

Round 6 of the same PR produced a second instance, in ordinary prose, and it is what widened this item.
The fix for round 5's advisory added this parenthetical to #3147's card:

> `grep -rl 3239 we:backlog/ we:skills-src/` returns exactly those two files.

It returns **three**. The very commit that wrote the sentence put `3239` on five lines of #3147's own
card, making that card the grep's third hit — the claim was falsified by the act of writing it. Run in the
fix lane at `13f2da58`:

```
$ grep -rl 3239 backlog/ skills-src/
backlog/3147-wire-the-conveyor-s-build-prepare-dispatch-onto-the-dispatch.md
backlog/3239-the-conveyor-tick-executes-spawnbuilds-by-hand-instead-of-th.md
skills-src/conveyor/SKILL.md
```

This one **carries** its command — so the original scope, which only asked that a stated outcome ship its
invocation, would have passed it. The gate that catches it is one step further on: run the quoted command
and compare. Both instances then reduce to one rule, which is why this is a widening and not a fourth card.

## The repeat — the defect recurring inside the card filed to prevent it

Round 7 of #1560 fixed the sentence above by replacing *"two files"* with a three-file listing. `50bcc3f6`,
**the commit that wrote that correction**, put `3239` into **this card** (the block quoted above), making a
fourth hit. The corrected count was falsified by the act of correcting it — the same shape, one round later,
in the card filed to stop it:

```
$ grep -rl 3239 backlog/ skills-src/          # at 50bcc3f6, bb914a00 and 77f69705 — four files at all three
backlog/3147-wire-the-conveyor-s-build-prepare-dispatch-onto-the-dispatch.md
backlog/3239-the-conveyor-tick-executes-spawnbuilds-by-hand-instead-of-th.md
backlog/3286-a-done-when-criterion-names-a-fixture-whose-stated-outcome-i.md
skills-src/conveyor/SKILL.md
```

This is the strongest fixture the card will get, and it is the argument for Half A being **executed** rather
than reviewed — but the argument is about the *juror*, not about review as a whole. Read off #1560's own
comment thread, two corrected counts have shipped and each was live for exactly one round:

| the count | entered at | the juror that round | the human reviewer that round |
| --- | --- | --- | --- |
| *"exactly those two files"* | `13f2da58` | returned one finding, **not this one** — the round-6 comment records *"I found a second one of the same family that the juror did not"* | **re-ran the grep at `13f2da58` and caught it** — raised as C2, BLOCKING |
| the three-file listing | `50bcc3f6` | returned **0** findings, its summary claiming it *"mechanically re-ran essentially every falsifiable claim it makes (grep counts, …)"* | **re-ran it at `50bcc3f6`, `bb914a00` and `77f69705` and caught it** — raised as D1, BLOCKING |

So the failure is two-sided and neither side is "review". **The juror read a corrected count twice and re-ran
it neither time**, once while asserting in its summary that it had — that is what Half A must replace, because
a claimed re-run is indistinguishable from a real one until someone runs it. **The author** shipped both
corrections without re-running them at the commit that carried them; the human reviewer caught both, in the
round each was pushed.

*(An earlier cut of this paragraph read **"three consecutive rounds of human and juror review read the
corrected count and none re-ran it."** **That was false against this PR's own comment thread, and it is
retracted.** There were two such rounds, not three, and in both the human reviewer re-ran the count and
caught it — the round-6 comment quotes its own run, ``$ grep -rl 3239 backlog/ skills-src/   # at
13f2da58``. Shipping an unchecked claim about a checkable artifact, inside the paragraph arguing that claims
must be checked rather than reviewed, is this card's own class.)*

The operative rule the repeat adds is *which head to run at* — **the commit that carries the correction**, not
the commit the fix started from. A correction re-run at the pre-fix head passes and still ships wrong.

## Why this is its own class

The three siblings cover the neighbouring shapes and none reaches this one:

| item | the class it gates | why it misses this one |
| --- | --- | --- |
| `3287` | a PR body's `key: value` span disagreeing with the diff | both instances are in a **card**, not a body, and neither quotes a frontmatter value |
| `3290` | a claim corrected at one site and left standing at another | both were **newly written**, not surviving copies — the `grep` instance was written *as* a correction |
| `3288` | a prose claim about another named item, staled by that item's amendment | both instances were false at the head that stated them, not falsified later by someone else's landed work |

The distinguishing shape is a *testable promise about a named artifact* — "run X and it returns R" — shipped
untested. It is the cheapest of the four to gate, because the text states its own test.

## The check — two halves, one rule

**Half A — a quoted invocation with a quoted result (anywhere in a card or a PR body).** A span is in range
when it carries a **runnable, side-effect-free read** (`grep`, `git show`, `git log`, `wc`, `node … --json`
on a read-only script) **and** an adjacent stated result — a count, a file list, an exit code, a quoted line.
Re-run it at the head that states it and compare. **Error** on a mismatch: the text supplied its own test and
failed it.

Bounded on purpose — only reads from the closed verb list above are re-run, never a build, a network call, or
anything that writes. A stated result with no runnable command is Half B's problem, not an error here.

**Half B — a *Done when* criterion that pins a fixture but ships no command.** A criterion is in range when
it names **both**:

- a **concrete fixture** — a commit sha, a PR number, a ref, or a repo file path; and
- a **stated outcome** — `exits 0`, `exits non-zero`, `returns N`, `warns`, `is green`/`red`, a count.

For a criterion in range:

- **error** when a named sha or path does not resolve in the repo — the fixture is not even addressable;
- **warn** when it resolves but the criterion carries no command that reproduces the stated outcome. A
  criterion that promises an exit code must ship the invocation that produced it.

Deliberately silent on the common form that names **no** fixture — *"`npm run check:standards` — no new
errors and no new warnings against the baseline at build time"* states an outcome against a moving baseline
and is correct as written. Half B is only for criteria that pinned an artifact, and Half A does not reach it
either: `npm run` is not on the closed verb list.

## Not in scope

**Judging whether the command is *the right* check.** Both halves take the text's own test at its word: Half A
re-runs it and compares, Half B asks that one exist. Neither asks whether a different check would have been
better.

*(An earlier cut of this section read **"Judging whether the reproducing command is the right check, **or
running it**. This item asks only that a criterion pinning a fixture carries the invocation, and that the
pin resolves."** The "or running it" clause is **retracted** — Half A runs it, and that is the whole of the
widening. Quoted rather than deleted because leaving it standing beside Half A would state the two readings
at once, which is the defect `3290` exists to catch.)*

Anything that is not a side-effect-free read from the closed verb list. A stated result for a build, a
network call, or a writing command is out of range in both halves — the cost of running it is not worth the
catch.

The siblings: the body-vs-diff half is `3287`, the fixed-here-standing-there half is `3290`, the
staled-by-another-lane half is `3288`, and the stale-`line N`-pointer half is `3289`. Half A does not
reach `3289`: a bare line pointer carries no command, so it never enters the closed verb list above.

## Done when

1. **Half B, executable** — a check that, given `we:backlog/3287-…md` as it stood at `fed61bc5`, flags
   *Done when* 1: it names a fixture (#1560's body at `3644b569`) and an outcome (*"it exits 0"*) and carries
   no reproducing command. The fixture is retrievable with `git show fed61bc5:<that path>`.
2. **Half B, mutation** — adding a reproducing invocation to that criterion clears the flag; deleting it
   raises the flag again. The check must key on the *absence of the command*, not on the presence of a sha.
3. A criterion naming a sha that does not resolve (`git cat-file -e`) is an **error**, not a warning —
   verified by a fixture carrying a fabricated sha.
4. **Half A, executable** — given #3147's card as it stood at `13f2da58`, the check re-runs the quoted
   `grep -rl 3239 …` and **errors**: the card states two files, the command returns three. Fixture in git
   with `git show 13f2da58:<#3147's card>`.
5. **Half A, mutation** — take that same `13f2da58` card and change only the stated result to the three files
   the command actually returned at that sha (the listing in *The widening* above, reproducible with
   `git show 13f2da58:<#3147's card>` plus `grep -rl 3239 backlog/ skills-src/` at `13f2da58`); the same
   check is then **silent**. The check must key on the *disagreement between the stated and the actual
   result*, not on the presence of a command.

   *(An earlier cut of this criterion read **"against the same card at this PR's head, where the sentence is
   retracted and the three-file result is quoted from a run, the same check is silent"**. **That was red where
   it promised green, and it is retracted.** At the head it named, `50bcc3f6` had just added `3239` to this
   card, so the grep returned **four** files against a stated three and Half A errors — see *The repeat*
   above. Re-pinned to a mutation of the `13f2da58` fixture, which is fixed in git and cannot move out from
   under the criterion the way a moving head did.)*
6. **Half A, bounded** — a span quoting `npm run check:standards` with a result is **not** re-run, because
   `npm run` is off the closed verb list. Verified against this card's own criterion 8.
7. **Half B, silent where it should be** — no flag on a *Done when* whose criteria name no fixture, verified
   against this card's own criterion 8 and #3147's criterion 4, both of which state an outcome with no pinned
   artifact.
8. `npm run check:standards` — no new errors and no new warnings against the baseline at build time.
