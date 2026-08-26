---
kind: story
size: 2
status: open
relatedTo: ["3147", "3035"]
dateOpened: "2026-08-25"
tags: [operations, review, backlog-quality, prevention]
---

# A Done-when criterion names a fixture whose stated outcome is wrong

Flag a *Done when* criterion that names a concrete fixture and asserts an outcome for it without carrying the one command that reproduces it, so a criterion cannot ship stating an exit code nobody ran.

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

## Why this is its own class

The two siblings already filed cover the neighbouring shapes and neither reaches this one:

| item | the class it gates | why it misses this one |
| --- | --- | --- |
| `xaemgqd` | a PR body's `key: value` span disagreeing with the diff | this defect is in a **card**, not a body, and quotes no frontmatter value |
| `xxzs9l7` | a claim corrected at one site and left standing at another | the wrong criterion was **newly written**, not a surviving copy of anything |

The distinguishing shape is a criterion that is a *testable promise about a named artifact* — "run X against
F and it exits 0" — shipped untested. It is the cheapest of the three to gate, because the criterion states
its own test.

## The check

In a backlog item's *Done when*, a criterion is in range when it names **both**:

- a **concrete fixture** — a commit sha, a PR number, a ref, or a repo file path; and
- a **stated outcome** — `exits 0`, `exits non-zero`, `returns N`, `warns`, `is green`/`red`, a count.

For a criterion in range:

- **error** when a named sha or path does not resolve in the repo — the fixture is not even addressable;
- **warn** when it resolves but the criterion carries no command that reproduces the stated outcome. A
  criterion that promises an exit code must ship the invocation that produced it.

Deliberately silent on the common form that names **no** fixture — *"`npm run check:standards` — no new
errors and no new warnings against the baseline at build time"* states an outcome against a moving baseline
and is correct as written. The gate is only for criteria that pinned an artifact.

## Not in scope

Judging whether the reproducing command is *the right* check, or running it. This item asks only that a
criterion pinning a fixture carries the invocation, and that the pin resolves. The body-vs-diff half is
`xaemgqd`; the fixed-here-standing-there half is `xxzs9l7`.

## Done when

1. **Executable** — a check that, given `we:backlog/xaemgqd-…md` as it stood at `fed61bc5`, flags *Done when*
   1: it names a fixture (#1560's body at `3644b569`) and an outcome (*"it exits 0"*) and carries no
   reproducing command. The fixture is retrievable with `git show fed61bc5:<that path>`.
2. **Mutation** — adding a reproducing invocation to that criterion clears the flag; deleting it raises the
   flag again. The check must key on the *absence of the command*, not on the presence of a sha.
3. A criterion naming a sha that does not resolve (`git cat-file -e`) is an **error**, not a warning —
   verified by a fixture carrying a fabricated sha.
4. Silent on a *Done when* whose criteria name no fixture — verified against this card's own criterion 5 and
   #3147's criterion 4, both of which state an outcome with no pinned artifact.
5. `npm run check:standards` — no new errors and no new warnings against the baseline at build time.
