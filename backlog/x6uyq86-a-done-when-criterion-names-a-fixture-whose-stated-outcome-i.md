---
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
as present-tense — fixed"*, tightened `xaemgqd`'s *Done when* 1 to read:

> Run against a body whose spans all match — #1560 at `3644b569` and after — it exits 0.

It exits 1. Implementing that card's own *Sketch* literally and running it on the named fixture returns two
disagreements, because #1560's body quotes superseded values inside retraction sentences — the convention
this repo requires — and quotes one frontmatter value belonging to an item the diff does not touch. Run in
this lane, at that fixture:

```
$ node <xaemgqd's Sketch, implemented literally> <#1560 body> fed61bc5
FAIL  body says `blockedBy: ["3118", "3165"]`  — diff writes `["3165"]`
FAIL  body says `kind: decision, status: open`  — diff writes `story`
4 span(s) compared, 2 disagreement(s) — exit 1
```

The criterion was authored, tightened, and reviewed without once being run against the fixture it names.

## The widening — the same defect outside a *Done when*

Round 6 of the same PR produced a second instance, in ordinary prose, and it is what widened this item.
The fix for round 5's advisory added this parenthetical to #3147's card:

> `grep -rl xbbscm5 we:backlog/ we:skills-src/` returns exactly those two files.

It returns **three**. The very commit that wrote the sentence put `xbbscm5` on five lines of #3147's own
card, making that card the grep's third hit — the claim was falsified by the act of writing it. Run in the
fix lane at `13f2da58`:

```
$ grep -rl xbbscm5 backlog/ skills-src/
backlog/3147-wire-the-conveyor-s-build-prepare-dispatch-onto-the-dispatch.md
backlog/3239-the-conveyor-tick-executes-spawnbuilds-by-hand-instead-of-th.md
skills-src/conveyor/SKILL.md
```

This one **carries** its command — so the original scope, which only asked that a stated outcome ship its
invocation, would have passed it. The gate that catches it is one step further on: run the quoted command
and compare. Both instances then reduce to one rule, which is why this is a widening and not a fourth card.

## Why this is its own class

The three siblings cover the neighbouring shapes and none reaches this one:

| item | the class it gates | why it misses this one |
| --- | --- | --- |
| `xaemgqd` | a PR body's `key: value` span disagreeing with the diff | both instances are in a **card**, not a body, and neither quotes a frontmatter value |
| `xxzs9l7` | a claim corrected at one site and left standing at another | both were **newly written**, not surviving copies — the `grep` instance was written *as* a correction |
| `xeh31dn` | a prose claim about another named item, staled by that item's amendment | both instances were false at the head that stated them, not falsified later by someone else's landed work |

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
at once, which is the defect `xxzs9l7` exists to catch.)*

Anything that is not a side-effect-free read from the closed verb list. A stated result for a build, a
network call, or a writing command is out of range in both halves — the cost of running it is not worth the
catch.

The siblings: the body-vs-diff half is `xaemgqd`, the fixed-here-standing-there half is `xxzs9l7`, and the
staled-by-another-lane half is `xeh31dn`.

## Done when

1. **Half B, executable** — a check that, given `we:backlog/xaemgqd-…md` as it stood at `fed61bc5`, flags
   *Done when* 1: it names a fixture (#1560's body at `3644b569`) and an outcome (*"it exits 0"*) and carries
   no reproducing command. The fixture is retrievable with `git show fed61bc5:<that path>`.
2. **Half B, mutation** — adding a reproducing invocation to that criterion clears the flag; deleting it
   raises the flag again. The check must key on the *absence of the command*, not on the presence of a sha.
3. A criterion naming a sha that does not resolve (`git cat-file -e`) is an **error**, not a warning —
   verified by a fixture carrying a fabricated sha.
4. **Half A, executable** — given #3147's card as it stood at `13f2da58`, the check re-runs the quoted
   `grep -rl xbbscm5 …` and **errors**: the card states two files, the command returns three. Fixture in git
   with `git show 13f2da58:<#3147's card>`.
5. **Half A, mutation** — against the same card at this PR's head, where the sentence is retracted and the
   three-file result is quoted from a run, the same check is **silent**. The check must key on the
   *disagreement between the stated and the actual result*, not on the presence of a command.
6. **Half A, bounded** — a span quoting `npm run check:standards` with a result is **not** re-run, because
   `npm run` is off the closed verb list. Verified against this card's own criterion 8.
7. **Half B, silent where it should be** — no flag on a *Done when* whose criteria name no fixture, verified
   against this card's own criterion 8 and #3147's criterion 4, both of which state an outcome with no pinned
   artifact.
8. `npm run check:standards` — no new errors and no new warnings against the baseline at build time.
