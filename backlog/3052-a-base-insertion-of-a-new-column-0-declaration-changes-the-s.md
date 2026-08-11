---
bornAs: x0pfbqp
kind: story
size: 2
status: resolved
dateOpened: "2026-08-09"
dateResolved: "2026-08-10"
graduatedTo: none
parent: "3054"
tags: [gate, review, drain, review-escalation, fingerprint]
scope:
  - we:scripts/lib/review-escalation.mjs
  - we:scripts/lib/__tests__/review-escalation.test.mjs
---

# A base insertion of a new column-0 declaration changes the section heading and false-stales an unmoved contribution

> **RESOLVED 2026-08-10, jointly with [#3046](/backlog/3046-a-stale-acceptance-re-park-fires-on-an-unchanged-contributio/).**
> The `@@` section heading is gone from `normalizeContributionFingerprint`, and the `POSITION` docblock this
> card demanded be corrected is rewritten around the impossibility rather than patched. WE PR #1100's two net
> diffs — rebuilt from the real commits and self-certified against the stamped `6a4f7c53…` / `b8dd7351…`
> markers — now hash **alike** (`2ba8be98…` both sides). A unit test reproduces the mechanism from real
> `git diff` output (`#3052 — a base INSERTION of a column-0 declaration no longer diverges it`), and a
> second one pins the empty/absent-heading case this card and `#3021` both flagged.
>
> **Two corrections to this card's own record, both re-derived by script.** (1) The two differing projection
> lines on #1100 are `@@ ~269 … exit 0` → `@@ ~300 … describe('#3039 — …` and `@@ ~23 … buildVerdictComment`
> → `@@ ~29 …`. The first line carries **both** mechanisms at once — its gap moved `269→300` *and* its heading
> changed — which this card recorded as a heading change alone. The conclusion is unaffected and in fact
> strengthened: neither slice alone would have saved #1100. (2) The inserted heading reads `describe('#3039
> — clear-human stamps …`, the bornAs id, not `describe('#3039 — …`. (3) The raw byte counts are 132,109 and
> 132,196 in UTF-8 bytes but 130,831 and 130,916 in JavaScript characters — the 87-vs-85 delta between those
> two rulers is why a `wc -c` check and a `.length` check disagree, and the card's wider point stands: compare
> the projection, not the raw bytes.

The contribution digest keeps git's `@@` **section heading** as a position signal, on the stated grounds that it
"travels WITH the code rather than with the base". That holds only when the base inserts **no new column-0
declaration**. Git's `xfuncname` picks the nearest preceding column-0 line starting with a letter — so when
`main` inserts a *new top-level declaration* above an unmoved hunk, the heading changes, the digest diverges on a
byte-identical contribution, and the acceptance reads stale. A **second** false-stale mechanism, independent of
the gap that [#3046](/backlog/3046-a-stale-acceptance-re-park-fires-on-an-unchanged-contributio/) owns.

Filed by the 2026-08-09 consolidation of the PR #1106 / PR #1100 incident. **No card owned this direction** — a
grep of every item in `we:backlog/` for `xfuncname`, `section heading` and `normalizeContributionFingerprint`
found the heading discussed only as a *collision* source (#3021) or as failing closed on a **rename** (the
docblock), never as diverging on a base **insertion**.

## What the code claims, and where the claim stops

[we:scripts/lib/review-escalation.mjs](scripts/lib/review-escalation.mjs), in the `POSITION` block of
`normalizeContributionFingerprint`'s docblock, states both halves:

> THE SECTION HEADING (`@@ … @@ <heading>`). Git's default `xfuncname` heuristic (no `.gitattributes` in this
> repo) picks the NEAREST PRECEDING LINE STARTING AT COLUMN 0 WITH A LETTER — a top-level declaration, not "the
> enclosing function". It travels WITH the code rather than with the base, so `main` inserting lines above does
> not change it […] If `main` RENAMES the top-level declaration the heading changes and the escape simply fails
> closed — the PR re-parks and the human re-clears, the safe direction.

The docblock anticipates exactly one base-driven heading change — a **rename** — and rules it acceptable. It does
not anticipate a base **insertion of a new declaration**, which produces the same failure with no rename
involved, and which is far more common: every landed PR that adds a top-level function, class or `describe()`
block to a file another lane is also touching is a candidate.

## Observed on WE PR #1100, 2026-08-09 — replicated by script

Timeline from `gh api repos/chalbert/web-everything/issues/1100/timeline`:

```
2026-08-09T12:20:04Z  clear-human comment posted   — reviewed head afcbd8d5
2026-08-09T12:20:05Z  labeled review:accepted, unlabeled review:human
2026-08-09T12:20:38Z  labeled ready-to-merge
2026-08-09T12:20:49Z  committed e6511618  drain: rebase lane/2844-refuse-self-cleared-verdict onto origin/main…
2026-08-09T12:20:56Z  unlabeled ready-to-merge
2026-08-09T12:20:57Z  labeled review:human          <- the clearance revoked, 52 seconds after it was granted
```

The net diffs, re-derived by script with the same basis `computeNetDiffText`
([we:scripts/merge-ai-prs.mjs](scripts/merge-ai-prs.mjs)) uses — `git diff <merge-base(main-tip, head)> <head>`:

- accept-time — main `a68b4902`, head `afcbd8d5`, merge-base `f761c7cd` → contribution digest `6a4f7c53…`
- post-rebase — main `a68b4902`, head `e6511618`, merge-base `a68b4902` → contribution digest `b8dd7351…`

**1,542 projection lines on each side, differing in exactly two**, and **zero** differing `+`/`-` lines — the
contribution is byte-identical. In `we:scripts/__tests__/review-set-label.test.mjs`:

```
- @@ -1124,3 +1131,186 @@ exit 0
+ @@ -1155,3 +1162,186 @@ describe('#3039 — clear-human stamps a clearance the re-score reader can fi
```

Same hunk, same `3`/`186` lengths, same content — but the heading moved from `exit 0` to a `describe(…)` block
that **`main` inserted**, because PR #1124 landed at `2026-08-09T11:50:32Z` and added that block to the same file
above the lane's hunk. The second differing line is an inter-hunk gap (`~23 → ~29` in
`we:scripts/review-set-label.mjs`), which is #3046's mechanism — so #1100 exhibits **both** at once, and fixing
only the gap would not have saved it.

**The irony is load-bearing, not decorative:** the commit that caused this false stale is
[#3039](/backlog/3039-drain-re-hold-must-never-silently-revoke-an-operator-review-/)'s own landing, and #3039's
newly-landed notice code is what made the revocation visible. The mechanism is reachable by ordinary traffic
between two lanes touching one test file.

## Why the raw byte counts differ, and why that is not a counter-argument

The two raw net diffs are **132,109** and **132,196** bytes — *not* identical. The 87-byte delta is entirely in
the parts the digest deliberately DROPS (absolute `@@` offsets, context lines, `index` blob-pair lines). The
projection the digest actually hashes differs in two lines only. A reviewer checking this by `wc -c` on the raw
diff would wrongly conclude the contribution changed; the projection is the thing to compare.

## Directions worth costing (none picked — see the umbrella)

- **Drop the heading from the digest** and re-detect relocation another way. Widens #3021's false-honour residual
  in exactly the way dropping the gap does — the same joint-cost problem, which is why this is a slice of
  `#3054` and not a standalone fix.
- **Attribute the move to its actor.** The drain knows it produced the rebase and could re-stamp the markers.
  Listed on #3021, #3046 and #2884 as well; it narrows all three false-stale directions at once and still does
  not cover a producer-lane force-push.
- **Recompute the reviewed side against the new base** rather than comparing two projections taken against
  different bases. Expensive, and it is the only direction that attacks the *class* rather than one signal.

## Acceptance

- A test reproduces this from real `git diff` text: one contribution, two bases differing only by a new column-0
  declaration inserted above the hunk, byte-identical `+`/`-` lines, and today's
  `normalizeContributionFingerprint` returning two different digests.
- The docblock's `POSITION` block is corrected in the same change — it currently asserts the heading is invariant
  under a base insertion, which the PR #1100 evidence above refutes. `#3021`'s pinned "known residual" test must
  not be left disagreeing with it.
