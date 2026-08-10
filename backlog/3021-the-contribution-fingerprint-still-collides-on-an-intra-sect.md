---
bornAs: x413mbt
kind: story
size: 2
status: open
dateOpened: "2026-08-08"
parent: "3054"
tags: [gate, review, drain, review-escalation, fingerprint]
scope:
  - we:scripts/lib/review-escalation.mjs
  - we:scripts/lib/__tests__/review-escalation.test.mjs
---

# The contribution fingerprint still collides when a relocation keeps its `@@` heading and hunk gaps unchanged

`normalizeContributionFingerprint` drops context lines so a clearance survives the drain rebasing a lane, and
that leaves one collision open: a contribution that MOVES while keeping the same `@@` section heading and the
same gap to its sibling hunks. This is WIDER than "one function, one hunk" — git's `@@` heading is the nearest
preceding line starting at column 0 with a letter (no `.gitattributes` in this repo), not "the enclosing
function", so the collision also covers a move between two methods of the *same* class, a move between two
blocks of one long top-level function, and **any** relocation inside an indented JSON/YAML file (no line there
starts at column 0, so the heading is empty and identical for the whole file). It is not limited to single-hunk
files either: a set of hunks that relocates uniformly preserves every gap and collides the same way. Closing it
needs evidence the digest does not carry — the same context the #1100 case requires it to tolerate.

## The shape

Reproduced with real `git diff` output — one added guard line placed at two different points inside the same
function of a 23-line file:

```
@@ -4,6 +4,7 @@ function only() {        @@ -13,6 +13,7 @@ function only() {
   s2();                                    s11();
   s3();                                    s12();
   s4();                                    s13();
+  if (!authorized) throw …                +  if (!authorized) throw …
   s5();                                    s14();
```

Same `+` line, same hunk lengths, same section heading, one hunk so no inter-hunk gap to compare →
byte-identical digest → `acceptanceCoversHead` returns `covers: true`. This is the "right line, wrong place"
class narrowed down to what PR #1119 could not close: a guard moved below the call it guards, inside one
function.

The same class of collision also reproduces, with real `git diff` output, in three shapes that are not "one
function, one hunk":

- **Two methods of one class.** A guard line moved from `async transfer()` to `async close()` of the same class
  — both hunks read `@@ … @@ export class AccountService {`, because git's heading tracks the nearest column-0
  declaration (the class), not the method.
- **Any relocation inside a JSON/YAML file.** Moving a line within this repo's own
  [we:package.json](package.json) (2-space indented) produces a bare `@@ -9,6 +9,7 @@` — an **empty** heading,
  because no line in the file starts at column 0 with a letter. No relocation inside any JSON/YAML file is ever
  distinguished by heading.
- **Multi-hunk files, not just single-hunk ones.** Two hunks relocated uniformly (e.g. old-side starts 7/48 →
  197/238, same 41-line gap, same heading) produce a byte-identical digest, because the inter-hunk-gap signal is
  preserved by construction under a uniform shift.

PR #1119 closed relocation **across files**, **across top-level declarations** (a move between two separate
top-level functions is caught, because their headings differ), and relocation **relative to a sibling hunk**
whose gap actually changes. What is not closed is any relocation that keeps both signals unchanged — which, as
above, is not limited to "an intra-section move in a single-hunk file". This item is what remains, and it is
pinned by a deliberately-passing test in the unit suite for
[we:scripts/lib/review-escalation.mjs](scripts/lib/review-escalation.mjs) ("THE KNOWN RESIDUAL, pinned") so
nobody reads the other cases as "relocation is solved".

## Why it is not a one-line fix

The only remaining witness to an intra-section move is the hunk's **context lines** — and the case the whole
escape exists for ([#3023](/backlog/3023-a-drain-re-score-revokes-a-human-clearance-a-content-preserv/),
WE PR #1100) is one where `main` changed the context line **immediately adjacent** to the contribution.
Tolerating that and detecting an intra-section move are the same measurement read in opposite directions, so no
fixed-size digest can do both.

## Directions worth costing

- **Per-hunk anchors instead of one digest.** Stamp a short list of per-hunk context digests beside the
  contribution digest and compare hunk-by-hunk. Buys fuzziness, but needs a tolerance threshold, and a
  threshold is itself an attack surface (relocate exactly one hunk in a large PR).
- **Attribute the move to its actor.** The drain KNOWS when it performed the rebase; a rebase it performed
  itself could carry the clearance forward by re-stamping `reviewed-sha`, reducing later passes to the strict
  SHA test. Does not cover a producer-lane force-push, so it narrows rather than closes.
- **Bound the escape by a recorded merge base.** Require the head advance to come with a base advance, so a
  relocation force-pushed onto an unchanged base is refused. Cheap; raises the bar rather than closing it.

## Bound on the exposure, meanwhile

The contribution escape is checked **last**, after the SHA test and the strict `normalizeDiffFingerprint` test,
so it can only ever honour an accept those already rejected — and only for a head advance in which every
added/removed line, every hunk length, every section heading and every inter-hunk gap is unchanged.

Related: [#3023](/backlog/3023-a-drain-re-score-revokes-a-human-clearance-a-content-preserv/) (parent),
[#2409](/backlog/2409/).
