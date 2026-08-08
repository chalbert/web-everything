---
kind: story
size: 2
status: open
dateOpened: "2026-08-08"
tags: [gate, review, drain, review-escalation, fingerprint]
scope:
  - we:scripts/lib/review-escalation.mjs
  - we:scripts/lib/__tests__/review-escalation.test.mjs
---

# The contribution fingerprint still collides on an intra-section relocation in a single-hunk file

`normalizeContributionFingerprint` drops context lines so a clearance survives the drain rebasing a lane, and that leaves one collision open: a contribution that MOVES within a single `@@` section heading, in a file where no sibling hunk records the move. Closing it needs evidence the digest does not carry — the same context the #1100 case requires it to tolerate.

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

PR #1119 closed the wider cases — relocation across files, across functions/sections (the `@@` section heading
is hashed), and relative to a sibling hunk (the inter-hunk gap is hashed). This item is what remains, and it is
pinned by a deliberately-passing test in the unit suite for
[we:scripts/lib/review-escalation.mjs](scripts/lib/review-escalation.mjs) ("THE KNOWN RESIDUAL, pinned") so
nobody reads the other cases as "relocation is solved".

## Why it is not a one-line fix

The only remaining witness to an intra-section move is the hunk's **context lines** — and the case the whole
escape exists for ([#x9xqexm](/backlog/x9xqexm-a-drain-re-score-revokes-a-human-clearance-a-content-preserv/),
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

Related: [#x9xqexm](/backlog/x9xqexm-a-drain-re-score-revokes-a-human-clearance-a-content-preserv/) (parent),
[#2409](/backlog/2409/).
