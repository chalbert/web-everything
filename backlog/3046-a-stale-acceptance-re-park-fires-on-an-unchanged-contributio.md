---
bornAs: xalaqel
kind: story
size: 3
status: open
dateOpened: "2026-08-09"
parent: "3054"
scope:
  - we:scripts/lib/review-escalation.mjs
  - we:scripts/lib/__tests__/review-escalation.test.mjs
tags: [gate, review, drain, review-escalation, fingerprint]
---

# A stale-acceptance re-park fires on an unchanged contribution when the base moves non-uniformly (a false stale)

The contribution digest `acceptanceCoversHead` reads is meant to be invariant under the base moving, so
an operator's clearance survives the drain's own rebase. It is not: it embeds each hunk's **gap** to the
previous hunk, which is invariant only under a *uniform* whole-file displacement. When `main` grows a
different number of lines above different hunks, the digest diverges on a byte-identical contribution, the
acceptance reads as stale, and `decideReviewGate` re-parks the PR to `review:human` — revoking a human
clearance over a change the author never made.

This is the **diverging** direction of the digest; the converging one — a false *honour* — is
[#3021](/backlog/3021-the-contribution-fingerprint-still-collides-on-an-intra-sect/).

## What is variant, and why

[we:scripts/lib/review-escalation.mjs](scripts/lib/review-escalation.mjs) rewrites every hunk header as
`@@ ~<gap> -,<oldLen> +,<newLen> @@<section heading>` inside `normalizeContributionFingerprint`, and its own
docblock states the invariance claim precisely (lines 891–893):

> THE INTER-HUNK GAP (this hunk's old-side start minus the previous hunk's, within the same file). A uniform
> whole-file displacement — the #1100 shape, `@@ -197,3` → `@@ -203,3` because the file grew above the hunk —
> leaves every gap unchanged. Any hunk that moves relative to its siblings changes one.

Both halves are true, and the second half is the hole. "Any hunk that moves relative to its siblings" does
not distinguish *who* moved it. The design intends it to catch **the contribution** relocating. It fires
just as readily when **the base** grows by a different amount above two of the contribution's hunks — a
non-uniform base move — which the contributor did not cause and cannot prevent.

## Observed on WE PR #1106 — timeline and measurement both replicated

The **label + commit timeline** is replicated. Read independently three times from
`gh api repos/chalbert/web-everything/issues/1106/timeline` — in the PR #1124 review, for this filing, and
again in the independent review of the PR that filed this card — matching line for line each time:

```
2026-08-09T00:34:00Z  unlabeled review:pending, unlabeled review:human, labeled review:accepted
2026-08-09T00:34:14Z  labeled ready-to-merge
2026-08-09T00:35:46Z  committed fd2a8232  drain: rebase lane/2908-converge-editor-gating onto origin/main…
2026-08-09T00:41:19Z  committed e97d6c3b  drain: rebase lane/2908-converge-editor-gating onto origin/main…
2026-08-09T00:41:26Z  unlabeled ready-to-merge
2026-08-09T00:41:28Z  labeled review:human      <- the clearance revoked
```

The head moved because of the **drain's own** rebase-drop commit `e97d6c3b`, not because the author pushed.

**Update 2026-08-09 — the measurement has now been re-derived, and one figure in it was WRONG.** The first cut
of this card recorded the measurement as single-sourced and unreplicated ("both net diffs reported as
~~137,799 bytes~~"), sourced only from the PR #1124 review's by-hand recomputation, with re-derivation listed as
part of this item's work. That re-derivation has been run for the 2026-08-09 consolidation, using the same basis
`computeNetDiffText` ([we:scripts/merge-ai-prs.mjs](scripts/merge-ai-prs.mjs)) uses —
`git diff <merge-base(main-tip, head)> <head>` — and it is **self-certifying**: the accept-time net diff
reproduces both markers stamped in the `00:33:59Z` clearance comment exactly, `reviewed-diff 3265beec…` and
`reviewed-contribution b5d1eafe…`, which proves the base reconstruction is the right one.

| | main tip | head | merge-base | net-diff bytes | contribution digest |
| --- | --- | --- | --- | --- | --- |
| accept-time | `926c3471` | `53b37954` | `543b9962` | **141,836** | `b5d1eafe…` (matches the stamp) |
| post-rebase | `7a58229f` | `e97d6c3b` | `7a58229f` | **141,836** | `e7b1d883…` (**diverged**) |

**The byte figure is 141,836, not ~~137,799~~.** The 137,799 figure was wrong and is retired; it appears with
the same single source on
[#3039](/backlog/3039-drain-re-hold-must-never-silently-revoke-an-operator-review-/), which is retired with it.
Everything else replicates exactly: **1,534 normalized projection lines on each side, differing in exactly two**
— the two inter-hunk gap values:

```
-@@ ~424 -,6 +,115 @@ export function panelRigorFromReasons(reasons) {
+@@ ~439 -,6 +,115 @@ export function panelRigorFromReasons(reasons) {
-@@ ~324 -,6 +,12 @@ function runComment(flags, asJson) {
+@@ ~328 -,6 +,12 @@ function runComment(flags, asJson) {
```

No `+`/`-` line, hunk length, section heading or file differs, and `main` grew 15 lines above one hunk and 4
above another (439−424 and 328−324) — a non-uniform move. The mechanism never depended on the byte figure
anyway: the docblock at lines 891–893 already states the gap is invariant only under a *uniform* displacement,
which is the whole argument.

## Why this was unowned when it was filed

Confirmed by reading each card, not inferred (and still true — the 2026-08-09 consolidation grouped these cards
under `#3054` without merging any of their scopes):

- **[#3021](/backlog/3021-the-contribution-fingerprint-still-collides-on-an-intra-sect/)** (`3021`, open)
  files the **inverse**: the digest *colliding* — two different contributions hashing alike, a false
  *honour*. Its argument turns on the gap being *preserved* under a uniform shift ("a set of hunks that
  relocates uniformly preserves every gap and collides the same way"). It does not file the diverging case.
- **[#3039](/backlog/3039-drain-re-hold-must-never-silently-revoke-an-operator-review-/)** (its code landed
  in PR #1124, merged 2026-08-09T11:50:32Z; **resolved 2026-08-09** by the consolidation, after its notice was
  observed firing in production on PR #1100 at 12:20:59Z) makes the re-hold **loud** — it
  posts a durable notice naming the clearer. It states in as many words that the diverging direction "is
  filed nowhere; this item does not close it". It fixes the silence, not the false stale.
- **[#2884](/backlog/2884-acceptance-coverage-keys-on-head-sha-identity-so-a-no-op-reb/)** (open) is the
  pre-escape framing — SHA identity re-parking a no-op rebase — written before the diff/contribution escapes
  existed. Its option 3 ("auto-re-stamp on a provably-identical rebase") overlaps a possible fix here, so the
  two should be costed together.
- A grep of every card in `backlog/` for `acceptanceCoversHead`, `normalizeContributionFingerprint`,
  `reviewed-contribution`, `stale acceptance` and `staleAcceptance` returns 13 items; each was read, and
  none files this direction.

## Relate, do not duplicate

[#3024](/backlog/3024-a-stale-acceptance-re-park-re-asserts-review-human-from-the-/) (`3024`, open) is a
**narrower** fix for the same incident: it narrows *which label* a genuine stale re-park applies, by scoring
the uncovered delta instead of the whole PR. This item attacks the layer above — whether the re-park should
fire at all. They are not the same fix and neither subsumes the other, but a fix to either changes what the
other is worth; see the note on #3024.

PR #1119 (merged 2026-08-08T23:09:39Z) landed the contribution-only fingerprint that fixed the **uniform**
case — the escape works, and #1106's own `review:accepted` survived because of it. What did not survive is
the `review:human` re-imposition on top.

**DONE — the consolidation ran on 2026-08-09; this instruction is discharged.** This card previously read
"five cards now sit on one incident … the first move on any of them should be to run them through
`/consolidate` … do that before claiming this card, not after." That was done, and the outcome is:

- **`#3054`** — a `kind: epic` umbrella over the digest-correctness work: this card, #3021, #2884, and a
  fourth slice `#3052` (a **second** false-stale mechanism the sweep found and no card owned — the section
  **heading** is variant when `main` inserts a new column-0 declaration above an unmoved hunk; observed on WE
  PR #1100 at 12:20:57Z). This card keeps its `NNN`, its `size: 3`, its scope and its body, and stays
  independently claimable — the umbrella exists so the joint cost is visible, not to merge the scopes.
- **`#3053`** — a `kind: decision` carving the live fork out of #3024 (whole-PR score vs uncovered-delta
  score vs a fourth `review:stale` hold tier), which also **files #3039's dangling deferral** instead of
  leaving it in a sentence. `#3054` is `blockedBy` it.
- **#3039** — resolved; its code landed in PR #1124 and its notice was observed firing in production.
- **#3024** — stays a story, fork trimmed to a pointer, `blockedBy: 3053`.

**This card is now claimable**, jointly costed with its siblings under `#3054`.

## Directions worth costing (none picked)

- **Drop the gap from the digest and re-detect relocation another way.** Closes this direction and widens
  #3021's. The two are the same measurement read in opposite directions, which is exactly why neither can be
  fixed alone — this must be costed jointly with #3021.
- **Attribute the move to its actor.** The drain knows it produced the rebase; a rebase it performed itself
  could carry the clearance forward by re-stamping the markers. Also listed on #3021 and on #2884; it
  narrows both directions at once and does not cover a producer-lane force-push.
- **Compare gaps with a tolerance rather than exactly.** Cheap, and a threshold is itself an attack surface
  (the same objection #3021 raises against per-hunk anchors).

## Acceptance

- A test reproduces the false stale from real `git diff` text: one contribution, two bases that grow by
  *different* amounts above two of its hunks, byte-identical `+`/`-` lines, and today's
  `normalizeContributionFingerprint` returning two different digests.
- ~~The 137,799-byte / two-line PR #1106 measurement is re-derived by a script from the two real commits, so
  the figure stops being review-sourced.~~ **Done 2026-08-09** — re-derived (see the table above); the figure
  is **141,836** bytes on both sides, the 137,799 figure was wrong, and the two-differing-gap-lines result and
  the 1,534-line projection count both replicate. A committed script for it is no longer owed by this card;
  what remains owed is the *unit test* in the bullet above.
- Whichever direction is taken, #3021's pinned "known residual" test is updated in the same change — the two
  residuals must never be allowed to disagree about what the digest promises. Under `#3054` this now extends
  to `#3052`'s heading direction: **three** residuals, one promise.
