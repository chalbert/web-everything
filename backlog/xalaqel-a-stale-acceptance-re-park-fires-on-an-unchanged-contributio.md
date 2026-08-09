---
kind: story
size: 3
status: open
dateOpened: "2026-08-09"
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

## Proven on WE PR #1106, twice, independently

Verified from the live timeline (`gh api repos/chalbert/web-everything/issues/1106/timeline`), re-read for
this filing:

```
2026-08-09T00:34:00Z  unlabeled review:pending, unlabeled review:human, labeled review:accepted
2026-08-09T00:34:14Z  labeled ready-to-merge
2026-08-09T00:35:46Z  committed fd2a8232  drain: rebase lane/2908-converge-editor-gating onto origin/main…
2026-08-09T00:41:19Z  committed e97d6c3b  drain: rebase lane/2908-converge-editor-gating onto origin/main…
2026-08-09T00:41:26Z  unlabeled ready-to-merge
2026-08-09T00:41:28Z  labeled review:human      <- the clearance revoked
```

The head moved because of the **drain's own** rebase-drop commit `e97d6c3b`, not because the author pushed.

**The measurement, and its provenance.** Both net diffs are 137,799 bytes and the two normalized 1,534-line
projections differ in **exactly two lines** — the two inter-hunk gap values:

```
-@@ ~424 -,6 +,115 @@ export function panelRigorFromReasons(reasons) {
+@@ ~439 -,6 +,115 @@ export function panelRigorFromReasons(reasons) {
-@@ ~324 -,6 +,12 @@ function runComment(flags, asJson) {
+@@ ~328 -,6 +,12 @@ function runComment(flags, asJson) {
```

Not one `+`/`-` line, hunk length, section heading or file differs. `main` grew 15 lines above one hunk and
4 above another — a non-uniform move. **This figure came from the PR #1124 review, recomputed by hand from
the real commits; it is not produced by any committed script and has not been replicated by an independent
run.** The same numbers are recorded on
[#3039](/backlog/3039-drain-re-hold-must-never-silently-revoke-an-operator-review-/) from that same review,
so the two cites share one source rather than corroborating each other. Reproducing it from a script is part
of this item's work.

## Why this is unowned

Confirmed by reading each card, not inferred:

- **[#3021](/backlog/3021-the-contribution-fingerprint-still-collides-on-an-intra-sect/)** (`x413mbt`, open)
  files the **inverse**: the digest *colliding* — two different contributions hashing alike, a false
  *honour*. Its argument turns on the gap being *preserved* under a uniform shift ("a set of hunks that
  relocates uniformly preserves every gap and collides the same way"). It does not file the diverging case.
- **[#3039](/backlog/3039-drain-re-hold-must-never-silently-revoke-an-operator-review-/)** (landed via
  PR #1124) makes the re-hold **loud** — it posts a durable notice naming the clearer. It states in as many
  words that the diverging direction "is filed nowhere; this item does not close it". It fixes the silence,
  not the false stale.
- **[#2884](/backlog/2884-acceptance-coverage-keys-on-head-sha-identity-so-a-no-op-reb/)** (open) is the
  pre-escape framing — SHA identity re-parking a no-op rebase — written before the diff/contribution escapes
  existed. Its option 3 ("auto-re-stamp on a provably-identical rebase") overlaps a possible fix here, so the
  two should be costed together.
- A grep of every card in `backlog/` for `acceptanceCoversHead`, `normalizeContributionFingerprint`,
  `reviewed-contribution`, `stale acceptance` and `staleAcceptance` returns 13 items; each was read, and
  none files this direction.

## Relate, do not duplicate

[#3024](/backlog/3024-a-stale-acceptance-re-park-re-asserts-review-human-from-the-/) (`xfdgdln`, open) is a
**narrower** fix for the same incident: it narrows *which label* a genuine stale re-park applies, by scoring
the uncovered delta instead of the whole PR. This item attacks the layer above — whether the re-park should
fire at all. They are not the same fix and neither subsumes the other, but a fix to either changes what the
other is worth; see the note on #3024.

PR #1119 (merged 2026-08-08T23:09:39Z) landed the contribution-only fingerprint that fixed the **uniform**
case — the escape works, and #1106's own `review:accepted` survived because of it. What did not survive is
the `review:human` re-imposition on top.

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
- The 137,799-byte / two-line PR #1106 measurement is re-derived by a script from the two real commits, so
  the figure stops being review-sourced.
- Whichever direction is taken, #3021's pinned "known residual" test is updated in the same change — the two
  residuals must never be allowed to disagree about what the digest promises.
