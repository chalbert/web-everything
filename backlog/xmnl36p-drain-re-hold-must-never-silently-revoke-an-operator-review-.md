---
kind: story
size: 3
status: open
dateOpened: "2026-08-08"
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

`review:accepted` survived — that is the `#x9xqexm` fix (PR #1119) holding. The residual failure is
the *re-imposition* of the hold on top of it.

## Root cause

1. The drain's own rebase-drop pass moved the head past the reviewed commit.
2. `acceptanceCoversHead` (`we:scripts/lib/review-escalation.mjs#acceptanceCoversHead`) declared the
   acceptance stale. The `#x9xqexm` contribution escape did not save it: the ONLY difference between
   the accept-time and post-rebase 137 KB net diffs is two inter-hunk GAP values
   (`~424 → ~439`, `~324 → ~328`) — `main` grew *between* the lane's own hunks. Not one `+`/`-`
   line, hunk length, section heading or file differs. (Re-verified in the PR #1124 review by
   recomputing both net diffs from the real commits: 137,799 bytes each, the recomputed accept-time
   contribution reproduces the stamped `b5d1eafe…` marker exactly, and precisely two projection
   lines differ — the two above.)

   **This is NOT the residual filed as `#x413mbt`, and the first cut of this item mis-cited it.**
   [#3021](/backlog/3021-the-contribution-fingerprint-still-collides-on-an-intra-sect/) (`x413mbt`)
   tracks the digest COLLIDING — two genuinely different contributions hashing alike, a false
   *honour*, which is why it notes the gap signal is *preserved* under a uniform shift. The inverse
   fired here:
   the digest DIVERGING on a contribution that did not change, a false *stale*, because the gap
   signal is variant under a NON-uniform base move. That direction is filed nowhere; this item does
   not close it, and naming it as already-owned would be exactly the "deferral that disappears" the
   [#3024](/backlog/3024-a-stale-acceptance-re-park-re-asserts-review-human-from-the-/)
   write-up warns about.
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
  cleared — the bare `/merge` sweep would land a tree the reviewer never saw (the #368 / #2366 hole);
- downgrading to `review:pending` makes a gate-self PR agent-clearable — `decideSetLabel` refuses
  `--to=accepted` only on a `review:human` PR, and `we:scripts/lib/auto-land-seam.mjs` writes
  `review:accepted` unattended in `enforce` mode. That hands an agent the #2285 clearance.

A fourth hold tier touches ~10 consumers plus the policy contract and its conformance suite. Filed
separately rather than smuggled in here.
