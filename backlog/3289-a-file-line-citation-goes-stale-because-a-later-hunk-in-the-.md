---
bornAs: xfw8svt
kind: story
size: 2
status: open
relatedTo: ["3147", "3035", "3280", "3285"]
dateOpened: "2026-08-25"
tags: [operations, review, backlog-quality, prevention, citation-verification]
---

# A file:line citation goes stale because a later hunk in the same lane shifts the line it points at

Anchor every `line N` pointer to the sentence it is cited for, and re-derive the number at the head that is
pushed — or pin it to a fixed sha. A pointer written against "this PR's head" is invalidated by any later
edit **above** it in the same lane, and every existing check passes on the result: the file resolves, the
line exists, and it reads as unrelated text. Warn when a card or PR body carries a `line N` citation whose
adjacent quoted sentence is not at line N in the named file at the head that states it.

## The observation this is filed from

PR #1560 (preparing #3147), round 9. `3288`'s *Done when* 3 cited two sentences in #3147's card by line
number "at this PR's head". The pointers were **correct when written and wrong one commit later**, moved by
a hunk in the same push:

```
$ git show 77f69705:<#3147's card> | grep -n '#3165\*\* carries it\|step 3b callable'
102:Per this card's own instruction, the gap is filed rather than absorbed: **#3165** carries it, and this card
127:**Consequence for sequencing:** #3165 lands first and makes step 3b callable; #3147 then rewires both steps

$ git show 775cd30f:<#3147's card> | grep -n '#3165\*\* carries it\|step 3b callable'
111:Per this card's own instruction, the gap is filed rather than absorbed: **#3165** carries it, and this card
136:**Consequence for sequencing:** #3165 lands first and makes step 3b callable; #3147 then rewires both steps
```

`775cd30f` — the commit that fixed round 8's D1 — added nine net lines to #3147's card in three hunks, all of
them **above** line 102:

```
$ git diff -U0 77f69705 775cd30f -- <#3147's card> | grep '^@@'
@@ -38,3 +38,9 @@      (+6)
@@ -45,0 +52 @@        (+1)
@@ -49,5 +56,7 @@      (+2)
@@ -187 +196,2 @@      (below both pointers)
```

The criterion pointing at those sentences was not re-read, so it shipped 102/127 against a card that now
reads 111/136. At `775cd30f`, line 102 reads *"So the prepare lists are **consumed and surfaced** — they are
not dropped…"* and line 127 reads *"**both** — #3096 and #3239 — are now `relatedTo`."* — neither is the
sentence cited. An implementer opening line 102 to build the fixture finds a paragraph about prepare lists.

**The mutation pair is fixed in git**: red at `775cd30f`, green at `77f69705`, on the same two sentences in
the same file. Nothing external moved; the lane shifted its own citation.

## Why this class and not one of the four already filed

| item | the class it gates | why it misses this one |
| --- | --- | --- |
| `3286` Half A | a **quoted invocation** with a stated result, re-run and compared | a bare `line N` pointer carries no command. Half A's verb list is closed (`grep`, `git show`, `git log`, `wc`, read-only `node … --json`) and a pointer is on none of it, so Half A never sees the span |
| `3286` Half B | a *Done when* pinning a fixture with **no reproducing command** | its error case is a fixture that **does not resolve**; its warn case is a missing command. Here the path resolves, the line exists, and the criterion is otherwise well-formed — at most a warn, and never for the right reason |
| `3288` | a prose claim about **another item**, staled by a **concurrent lane** amending it | this drift is intra-lane and intra-commit: same author, same push, same file. Nothing landed underneath |
| `3290` | a claim corrected at one site while the same claim stands at another | nothing was corrected here. The citation's text never changed — the target moved out from under it |
| `3287` | a PR body's `key: value` frontmatter span vs the diff | not a body, not frontmatter, not a `key: value` span |

And the three that landed on `main` while this PR was open:

- **#3280** (`we:backlog/3280-review-lens-an-x-already-handles-this-claim-must-line-cite-t.md`) asks that an
  *"X already handles this"* claim **carry** a line cite. Here the line cite was carried; carrying it is not
  the failure.
- **#3284** (`we:backlog/3284-gate-a-backlog-filing-that-asserts-existing-code-behaviour-m.md`) warns on an
  existing-code assertion with **no** `we:path:line` citation in the paragraph. This paragraph has one.
- **#3285** (`we:backlog/3285-review-lens-an-acceptance-criterion-that-names-an-existing-t.md`) is the
  nearest neighbour: a criterion naming a test location whose **stated proof** is false. There the location
  is right and the claim about its content is wrong. Here the claim about the content is right and the
  **number** is wrong. Its remedy — quote the assertion you rely on — is half of this card's remedy, but it
  never asks that the number be re-derived, which is the half that failed.
- `we:agent-memory-src/grep-every-name-you-cite-in-prose.md` covers names that do not exist and counts
  written from memory. A line number that **resolves** and points at the wrong line is neither: it greps
  clean.

The distinguishing shape is a citation whose **address is separable from its content**. A name, a sha and a
count are all self-describing — checking them means checking the thing itself. A line number is a pointer,
and the only way to check it is to dereference it at the exact head that states it.

## The check

A span is in range when it carries **both** a `line N` / `lines N–M` pointer **and** an adjacent quoted
sentence attributed to a resolvable file. **Warn** when the quoted sentence is not on line N in that file at
the head being pushed.

- Silent when the pointer names a **fixed sha** (`git show <sha>:<path>`) and the quote is at line N there —
  a sha cannot move.
- Silent when the citation carries a quote and **no** number, which is the cheapest correct form.
- Out of range when there is no quoted text to anchor to. Nothing can be dereferenced, and guessing which
  sentence was meant is not this check's job — that is `3286` Half B's warn.

The remedy the check pushes authors toward is either **drop the number** or **pin the sha**, both of which
are drift-proof; re-deriving against a moving head is the form that keeps failing.

The siblings: the quoted-command-wrong-result half is `3286`, the amended-by-another-lane half is
`3288`, the fixed-here-standing-there half is `3290`, and the body-vs-own-diff half is `3287`.

## Done when

1. **Executable** — given `we:backlog/3288-a-card-s-prose-claim-about-another-item-s-current-content-is.md`
   as it stood at `775cd30f`, and #3147's card at that same sha, the check **warns** on *Done when* 3: the
   span quotes *"**#3165** carries it"* against *"line 102"*, and at `775cd30f` that sentence is at line 111.
   Both fixtures are in git: `git show 775cd30f:<3288's card>` and `git show 775cd30f:<#3147's card>`.
2. **Mutation, moving head** — run that same criterion text against #3147's card at `77f69705` instead, and
   the check is **silent**: there the quoted sentence really is at line 102. The check must key on the head it
   is asked about, and the pair proves it discriminates rather than always firing. Fixture:
   `git show 77f69705:<#3147's card>`.
3. **Mutation, pinned sha** — take the same criterion text and replace *"at this PR's head"* with *"at
   `77f69705`"*; the check is then **silent whatever head it runs at**, because the citation now dereferences
   against a sha. This is the drift-proof form the warning pushes authors toward, and it must not warn.
4. **Silent on a quote with no number** — no warning on a span that quotes a sentence from a resolvable file
   and names no line. Verified against `3288`'s *The observation* section at `775cd30f`, which quotes
   #3147's *Interfaces* sentence (*"#3118's Fork 1 default (a) is a WE-native in-process runner …"*, that
   card's line 190 at `775cd30f`) with no line number attached.
5. It warns and never fails the gate — verified by a fixture that warns while the run still exits 0.
6. `npm run check:standards` — no new errors and no new warnings against the baseline at build time.
