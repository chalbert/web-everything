---
kind: story
size: 3
status: open
relatedTo: ["3147", "3035"]
dateOpened: "2026-08-25"
tags: [operations, review, backlog-quality, prevention]
---

# A card's prose claim about another item's current content is never re-read when that item is amended

Diff a card's prose characterisation of a *different, explicitly named* backlog item against that item's live
content at land time, so a premise that was true at the merge base cannot land false because a concurrent
lane amended the item it cites.

## The observation this is filed from

PR #1560 (preparing #3147) was bounced in round 6 on a sentence that was **correct when it was written and
false 38 minutes later**, without anyone touching it. The card's *Interfaces* section said:

> #3118's Fork 1 default (a) is a WE-native in-process runner … so naming the operation in prose sits on the
> default side of the fork and pre-empts neither branch.

Timeline, every commit read in the lane rather than recalled:

| when | commit | what |
| --- | --- | --- |
| 2026-08-25 20:35:21 | `3644b569` | the sentence enters #3147's card. **True**: at `60acbe5f`, #3118's glance row reads *"**(a) WE-native runner**"* |
| 2026-08-25 21:11:52 | `13f2da58` | #1560's round-6 push carries it forward unchanged, still true |
| 2026-08-25 21:13:11 | `b71595f9` | PR #1565 lands, amending #3118: the glance row now reads *"**(c) call the existing `dispatch-lane` operation**"* and (a) moves to *excluded alternatives* |
| land time | `e6db8cf5` | the sentence is **false** on the `main` #1560 would land on |

```
$ git show 60acbe5f:backlog/3118-…md | grep '^| 1 |'
| 1 | Where the agent-spawn backend lives | **(a) WE-native runner** — port the contract into …

$ git show e6db8cf5:backlog/3118-…md | grep '^| 1 |'
| 1 | Where the agent-spawn backend lives | **(c) call the existing `dispatch-lane` operation** — …
```

Nothing in the author's control would have caught it. The sentence was run against the item it cites, at the
merge base, and the citation went stale *behind* the lane. What makes it worth a gate rather than a shrug is
that it was **load-bearing**: it was the stated premise for two structural decisions on the card — the scope
of the skill file alone, and the retraction of `blockedBy: ["3118"]` — and it was presented as one of two
checks *"run in this lane rather than reasoned from the card."*

## The check

At land time — the moment the lane is rebased or merged onto the `main` it will land on — for each prose
sentence in a changed backlog card that **both**:

- names another backlog item explicitly (`#NNNN`, or a born-as hash), **and**
- makes a present-tense claim about that item's *content* — quoting it, or asserting one of its
  frontmatter values, its default option, its status, or a phrase attributed to it;

re-read the cited item **at the target `main`**, not at the merge base, and report when the quoted or
asserted content is not found there.

Deliberately a **warning, not an error**, and deliberately narrow:

- it fires only on a claim with a *locatable* referent — a quoted string or a named frontmatter key — so
  "#3165 carries the gap" is out of range and "#3118's default is (a)" is in range;
- a warning is the right severity because a stale citation often survives with its conclusion intact (it did
  here), and the fix is a retraction in place rather than a rewrite.

## Why this is its own class

The three siblings already filed for this PR each gate a different failure, and none reaches this one:

| item | the class it gates | why it misses this one |
| --- | --- | --- |
| `xaemgqd` | a PR **body**'s `key: value` span vs the PR's **own** diff | this claim is in a card, is prose rather than a `key: value` span, and is about an item the diff does **not** touch — `xaemgqd`'s binding filter deliberately *skips* exactly this span |
| `xxzs9l7` | a claim corrected at one site and left standing at another | there was no correction and no second site — one sentence, written once, never edited |
| `x6uyq86` | a quoted invocation whose quoted result does not reproduce | this claim carries no invocation; it is a characterisation, and it was true when run |

The distinguishing shape is a claim that is **true at authoring time and falsified by someone else's landed
work**. It is the only member of the family a re-read by the author cannot prevent, which is why the check
must run against the *target* `main` rather than the lane's basis.

## Not in scope

Deciding whether the stale citation's **conclusion** still holds — that is judgment and stays with the fix
agent. This item only surfaces that the cited content moved. In the founding instance the conclusion survived
untouched and only the premise needed a retraction.

Claims about **code** paths rather than backlog items. `we:agent-memory-src/grep-every-name-you-cite-in-prose.md`
already covers citing a name that does not exist; this is about a name that exists and whose *content*
changed under the lane.

The sibling classes: the body-vs-own-diff half is `xaemgqd`, the fixed-here-standing-there half is
`xxzs9l7`, and the quoted-command-wrong-result half is `x6uyq86`.

## Done when

1. **Executable** — given #3147's card as it stood at `13f2da58` and a target `main` of `e6db8cf5`, the check
   warns on the *Interfaces* sentence citing #3118's Fork 1 default, printing the asserted content
   (*"(a) WE-native runner"*) beside what #3118 says at `e6db8cf5` (*"(c) call the existing `dispatch-lane`
   operation"*). Both fixtures are in git: `git show 13f2da58:<#3147's card>` and
   `git show e6db8cf5:<#3118's card>`.
2. **Mutation** — run with a target of `60acbe5f` instead of `e6db8cf5`, the same card and the same sentence
   produce **no** warning, because the claim was true there. The check must key on the *target* `main`, not
   on the lane's merge base; running it against the basis is the failure mode it exists to catch.
3. It is silent on a sentence that names another item without asserting its content — verified against
   #3147's *"**#3165** carries it"* (that card's line 102 at this PR's head), which names an item and quotes
   nothing from it, and against *"#3165 lands first and makes step 3b callable"* (line 127), which asserts a
   sequencing consequence rather than #3165's content.
4. It warns and never fails the gate — verified by a fixture that warns while the run still exits 0.
5. `npm run check:standards` — no new errors and no new warnings against the baseline at build time.
