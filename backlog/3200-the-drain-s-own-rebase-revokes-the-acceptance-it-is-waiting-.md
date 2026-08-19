---
bornAs: x5e2ldj
kind: story
size: 3
status: open
dateOpened: "2026-08-19"
tags: []
---

# the drain's own rebase revokes the acceptance it is waiting for, so a cleared PR re-parks forever

Observed live 2026-08-19 on PR #1445. A clearance landed through the sanctioned path (`{"ok":true,"pr":1445,"to":"clear-human","labels":["review:accepted"]}`), and four minutes later the drain rebased that lane onto the newly-merged main and re-parked `review:human`. Clear, rebase, re-park, repeat — the operator has hit this loop repeatedly. `we:scripts/lib/review-escalation.mjs` already names the fix in its own POSITION section: "ATTRIBUTE THE MOVE TO ITS ACTOR (the drain knows it produced the rebase, so it could re-stamp rather than re-derive)". The drain is the one actor that KNOWS its rebase was content-preserving, and it is the one actor currently throwing that knowledge away.

## The measured sequence

| time (UTC) | what |
|---|---|
| 13:03 | PR #1477 merges; `main` moves |
| 13:06:48 | the clearance for #1445 lands through CI — `we:scripts/review-set-label.mjs` reports `labels: ["review:accepted"]`, markers stamped at head `4266d453` |
| ~13:07 | `f5bc7940 drain: rebase lane/3154-slice-we-blocks-router-runtime-to-fui onto origin/main, drop the transient lane manifest` |
| after | `review:human` is back; the acceptance no longer covers the head |

A second clearance, issued against the rebased head, stuck — which confirms the trigger is the rebase and
not the clearance.

## What it is NOT

**Not the manifest drop.** `normalizeContributionFingerprint` in `we:scripts/lib/review-escalation.mjs`
already skips the whole `we:.lane-manifest.json` section (`inManifestSection`), so shedding it cannot move the
digest. That was the first hypothesis and it is wrong; recorded here so the next reader does not spend the
same hour on it.

**Not a digest bug.** The contribution digest deliberately keeps one `~<n>` marker per run of consecutive
context lines. A rebase onto a moved `main` can change those run LENGTHS while every `+`/`-` line stays
byte-identical — the file's own POSITION section works through exactly this case. The digest is behaving as
specified; the specification simply cannot distinguish "the author changed the contribution" from "the base
moved underneath it" from two projections taken against different bases.

## The fix the codebase already named

`we:scripts/lib/review-escalation.mjs` states the two viable routes, both outside the digest:

> ATTRIBUTE THE MOVE TO ITS ACTOR (the drain knows it produced the rebase, so it could re-stamp rather than
> re-derive) or RECOMPUTE THE REVIEWED SIDE AGAINST THE NEW BASE.

The first is the cheap one and it fits the observed failure exactly. The drain is the only actor that KNOWS
its rebase was content-preserving — it performed it — and it is the only actor currently discarding that
knowledge, then asking a gate to re-derive what it already knew.

**The asymmetry that makes this a bug rather than a trade-off:** `needsManifestStripBeforeMerge` already
carries the principle in a comment — *"a held PR must NEVER be manifest-stripped (a force-push mutation);
reviewHeld PRs are excluded here on purpose"*. The merge path protects a held PR from a drain-authored
mutation. The rebase-drop path (`isRebaseDropCandidate`, #2198) has no equivalent, and it mutates an
ACCEPTED PR — where the damage is not a lost hold but a lost clearance.

## Done when

1. **Executable** — a test driving a drain-authored rebase-drop over a PR carrying valid acceptance markers,
   asserting the markers are re-stamped at the new head and the PR is NOT re-parked. It fails today.
2. The re-stamp happens ONLY for a rebase the drain itself produced and only when the pre-rebase acceptance
   was valid — never as a way to manufacture an acceptance that did not exist.
3. A rebase that is NOT content-preserving (a real conflict resolution, an author push) still invalidates,
   with a test pinning that the escape does not widen to it.
4. The durable comment records that the marker was re-stamped by the drain rather than earned by a fresh
   review, so the record does not overstate what happened.
