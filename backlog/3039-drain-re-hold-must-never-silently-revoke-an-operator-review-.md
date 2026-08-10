---
bornAs: xmnl36p
kind: story
size: 3
status: resolved
dateOpened: "2026-08-08"
dateResolved: "2026-08-09"
graduatedTo: none
tags: []
---

# Drain re-hold must never silently revoke an operator review:human clearance

The drain's stale-acceptance re-park re-applies `review:human` to a PR an operator had just cleared
via `we:scripts/review-set-label.mjs --to=clear-human`, and it does so with no comment: the
human-park path posts none by design, and its PR-body block is a one-shot append. Observed on WE
PR #1106 — cleared 00:34:00Z, re-held 00:41:28Z, silent. This reads the clearance record back and
makes such a re-hold post a durable notice naming who cleared it, why the clearance lapsed, and the
exact re-clear command. The merge verdict is unchanged: nothing new lands, no agent gains a clearance.

## The incident (WE PR #1106)

Verified label + commit timeline from `gh api repos/chalbert/web-everything/issues/1106/timeline`:

```
00:33:59Z  clear-human comment posted — stamped reviewed-sha 53b37954,
           reviewed-diff 3265beec…, reviewed-contribution b5d1eafe…
00:34:00Z  unlabeled review:pending, unlabeled review:human, labeled review:accepted
00:34:14Z  labeled ready-to-merge
00:35:46Z  committed fd2a8232  "drain: rebase lane/2908-… onto origin/main, drop .lane-manifest.json"
00:41:19Z  committed e97d6c3b  "drain: rebase lane/2908-… onto origin/main, drop .lane-manifest.json"
00:41:26Z  unlabeled ready-to-merge
00:41:28Z  labeled review:human            <- the clearance revoked, NO comment
```

`review:accepted` survived — that is the `#3023` fix (PR #1119) holding. The residual failure is
the *re-imposition* of the hold on top of it.

## Root cause

1. The drain's own rebase-drop pass moved the head past the reviewed commit.
2. `acceptanceCoversHead` (`we:scripts/lib/review-escalation.mjs#acceptanceCoversHead`) declared the
   acceptance stale. The `#3023` contribution escape did not save it: the ONLY difference between
   the accept-time and post-rebase net diffs is two inter-hunk GAP values
   (`~424 → ~439`, `~324 → ~328`) — `main` grew *between* the lane's own hunks. Not one `+`/`-`
   line, hunk length, section heading or file differs. (Re-derived by script on 2026-08-09 for the
   consolidation, self-certifying because the accept-time contribution reproduces the stamped
   `b5d1eafe…` marker exactly: both net diffs are **141,836 bytes** and precisely two of the 1,534
   projection lines differ — the two above. **Correction:** the ~~137,799 bytes~~ figure this card
   originally carried, from the PR #1124 review's by-hand recomputation, is **wrong** and is retired.)

   **This is NOT the residual filed as `#3021`, and the first cut of this item mis-cited it.**
   [#3021](/backlog/3021-the-contribution-fingerprint-still-collides-on-an-intra-sect/) (`3021`)
   tracks the digest COLLIDING — two genuinely different contributions hashing alike, a false
   *honour*, which is why it notes the gap signal is *preserved* under a uniform shift. The inverse
   fired here:
   the digest DIVERGING on a contribution that did not change, a false *stale*, because the gap
   signal is variant under a NON-uniform base move. ~~That direction is filed nowhere~~ — it was filed
   the same day as
   [#3046](/backlog/3046-a-stale-acceptance-re-park-fires-on-an-unchanged-contributio/), and on
   2026-08-09 both were grouped under the umbrella `#x5p1xz8` alongside a **second** false-stale
   mechanism nobody had owned (`#x0pfbqp` — the section HEADING is also variant, when `main` inserts a
   new column-0 declaration above an unmoved hunk). This item still does not close either direction.
3. `decideReviewGate`'s stale branch computed `toHuman = humanRequired || <sticky human label>`;
   the fresh score was `humanRequired` (statute + gate-derivation + blast-radius + size), so it
   re-applied `review:human` — the exact hold the operator had lifted seven minutes earlier.
4. **Nothing consulted the clearance record.** The `--to=clear-human` comment is durable and
   attributed, and no code path read it back.
5. **The re-hold was silent.** `shouldPostParkReasonComment({ humanRequired: true })` is `false` by
   design (#2333), so a human park posts no comment; the reason goes only into the PR body via the
   #2324 block, whose write is gated on `!bodyHasEscalationReason(liveBody)` — a ONE-SHOT append. So
   the first re-hold buries the reason at the bottom of the PR body and every later one writes
   nothing at all.

## What this item does

- `parseOperatorClearance` / `buildClearedHumanMarker` — the clearance record, read back. Parses the
  new `<!-- cleared-human: <actor> -->` marker *and* the pre-existing prose attribution line, so PRs
  cleared before this item (#1106 among them) are covered.
- `decideReviewGate` gains `operatorClearance` and returns `revokesClearance` + `clearance` when a
  stale re-park is ADDING `review:human` back over a clearance. `action`, `applyLabel`,
  `humanRequired` and `staleAcceptance` are byte-identical to before — the merge verdict does not move.
- The drain posts `buildClearanceRevocationComment` unconditionally on that flag, ahead of and
  outside both suppression paths. The notice names the head SHA, so the existing exact-text dedup
  posts once per distinct head.

## What this item does NOT do (and why)

It does not make the re-hold *impossible*. "Never re-impose `review:human` over a clearance" needs a
hold label that is neither operator-only nor agent-clearable:

- dropping the hold entirely leaves `review:accepted` alone, which `hasUnclearedReviewLabel` reads as
  cleared — the bare `/merge` sweep would land a tree the reviewer never saw (the
  [#2366](/backlog/2366-merge-step-must-refuse-an-un-cleared-review-pending-pr-concu/) hole; this card
  originally cited it as "the ~~#368~~ / #2366 hole", but #368 is *Data Table — per-column cell
  formatter* and has nothing to do with the review gate — a mis-citation, corrected 2026-08-09);
- downgrading to `review:pending` makes a gate-self PR agent-clearable — `decideSetLabel` refuses
  `--to=accepted` only on a `review:human` PR, and `we:scripts/lib/auto-land-seam.mjs` writes
  `review:accepted` unattended in `enforce` mode. That hands an agent the #2285 clearance.

A fourth hold tier touches ~10 consumers plus the policy contract and its conformance suite. Filed
separately rather than smuggled in here.

## Closed out 2026-08-09 — delivered, and the dangling deferral is now real

**The code landed in PR #1124**, merged `2026-08-09T11:50:32Z`. `parseOperatorClearance`,
`buildClearedHumanMarker`, `buildClearanceRevocationComment` and `decideReviewGate`'s
`operatorClearance` / `revokesClearance` all resolve in
[we:scripts/lib/review-escalation.mjs](scripts/lib/review-escalation.mjs).

**Verified in production, not just in the suite.** 30 minutes after PR #1124 merged, the drain revoked a
clearance on WE PR #1100 (cleared `12:20:05Z`, re-parked `12:20:57Z`) and — because of this item — posted
the notice at `12:20:59Z`: it named the clearer, the reason, the head SHA `e651161841e2` and the exact
re-clear command, and pointed at the drain's own rebase as the likely cause. That is this item's
deliverable observed working on a real revocation it did not anticipate.

**The deferral in the section above is no longer dangling.** "Filed separately rather than smuggled in
here" was never actually filed — a grep of every item in `we:backlog/` for `review:stale` and "hold tier"
returned only this sentence. The 2026-08-09 consolidation folded the fourth-tier proposal into the carved
decision **`#xxdslno`** as its option C, rather than opening a sixth card on one hole, per the operator's
direction. The cost figure quoted above (~10 consumers) is carried across as **unreplicated** — counting it
for real is prep owed on `#xxdslno`.

Nothing further is owed here. The false-stale root causes live under the umbrella `#x5p1xz8`
([#3046](/backlog/3046-a-stale-acceptance-re-park-fires-on-an-unchanged-contributio/) and `#x0pfbqp`);
making the re-hold *impossible* is `#xxdslno`'s ruling to make.
