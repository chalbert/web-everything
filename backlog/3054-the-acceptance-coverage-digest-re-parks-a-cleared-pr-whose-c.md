---
bornAs: x5p1xz8
kind: epic
status: open
dateOpened: "2026-08-09"
tags: [gate, review, drain, review-escalation, fingerprint]
blockedBy: ["3053"]
relatedReport: reports/2026-08-09-backlog-consolidation-analysis.md
---

# The acceptance-coverage digest re-parks a cleared PR whose contribution never changed

> **DIGEST REPAIRED 2026-08-10 — the two false-stale slices are closed; the epic stays OPEN on the other two.**
> `#3046` and `#3052` are **resolved together**: both base-derived position signals (the inter-hunk gap and
> git's `@@` section heading) are out of `normalizeContributionFingerprint`, and both 2026-08-09 incidents now
> re-hash alike from their real commits — WE PR #1106 `b5d1eafe…`/`e7b1d883…` → `eae879d2…` both sides, WE
> PR #1100 `6a4f7c53…`/`b8dd7351…` → `2ba8be98…` both sides — with the accept-side reconstruction self-certified
> by reproducing all four stamped markers exactly.
>
> **Why the epic does not close with them.** `#3021` and `#2884` are untouched, and `#3021` is **deliberately
> widened**: relocation detection cannot survive base-invariance. Everything the digest can see about position
> is a hunk's old-side start, and a base growing *k* lines above the contribution is byte-identical, in the
> projection, to the contribution relocating *k* lines down an unchanged base — headings included. So a signal
> invariant under every base move is blind to every relocation; the two properties are mutually exclusive, not
> a tuning problem. Proved from real `git diff` output in the unit suite. `#3021`'s pin was widened in the same
> change, as this card's *joint constraint* requires: three residuals, one promise.
>
> **Measured, not asserted.** 16 stamp-certified accept→head pairs from recent history plus 201 machine-replayed
> content-preserving rebases onto four different bases: 5 false stales before, **0** after; 181/181 genuine
> contribution changes still detected. The residual that remains on the invariance side errs the safe way — a
> base edit *inside* a hunk's own context window changes the hunk lengths, the digest diverges, and a human
> re-clears. **What is still owed here:** `#3021` (now wider) and `#2884` (the caller). Both viable closures for
> `#3021` are outside the digest — attribute the move to its actor, or recompute the reviewed side against the
> new base.

Umbrella for the 2026-08-09 clearance-revocation incident on WE PR #1106 and WE PR #1100.
`normalizeContributionFingerprint` ([we:scripts/lib/review-escalation.mjs](scripts/lib/review-escalation.mjs))
mis-reads a base move the **drain itself** produced as a contribution change — a false *stale* that revokes an
operator's clearance — and, read the other way, mis-reads a real contribution move as no change — a false
*honour*. One measurement, so no slice can be costed alone.

Sliced into [#3021](/backlog/3021-the-contribution-fingerprint-still-collides-on-an-intra-sect/) (false honour),
[#3046](/backlog/3046-a-stale-acceptance-re-park-fires-on-an-unchanged-contributio/) (false stale, gap signal),
`#3052` (false stale, heading signal — filed by this consolidation, previously unowned), and
[#2884](/backlog/2884-acceptance-coverage-keys-on-head-sha-identity-so-a-no-op-reb/) (the coverage key, and the
convergence requirement the digest work must satisfy).

## Why an umbrella and not four separate claims

Filed per the consolidation rubric in
[we:docs/agent/backlog-workflow.md](docs/agent/backlog-workflow.md) (*Consolidating related items*). All four
slices rewrite the SAME function's position signals or the caller that reads them, and three of the four bodies
already say in as many words that they cannot be fixed independently: `#3046` — "the two are the same measurement
read in opposite directions, which is exactly why neither can be fixed alone"; `#3021` — "tolerating that and
detecting an intra-section move are the same measurement read in opposite directions, so no fixed-size digest can
do both"; `#2884` — option 3 ("auto-re-stamp on a provably-identical rebase") is listed verbatim as a direction on
both `#3021` and `#3046`. Each slice keeps its own `size` and stays independently claimable; the umbrella exists
so the **joint cost** is visible before any one of them is claimed, and so the digest's two residual tests can
never be allowed to disagree about what it promises.

## The incident, replicated

Two revocations on 2026-08-09, both with the head moved **only** by the drain's own rebase-drop commit:

| PR | cleared | re-parked | mechanism |
| --- | --- | --- | --- |
| [#1106](https://github.com/chalbert/web-everything/pull/1106) | `2026-08-09T00:34:00Z` | `2026-08-09T00:41:28Z`, **silently** | inter-hunk **gap** divergence (`#3046`) |
| [#1100](https://github.com/chalbert/web-everything/pull/1100) | `2026-08-09T12:20:05Z` | `2026-08-09T12:20:57Z`, with a notice | **gap** divergence **and** section-**heading** drift (`#3052`) |

Both timelines read from `gh api repos/chalbert/web-everything/issues/<n>/timeline`. #1100 got a notice because
[#3039](/backlog/3039-drain-re-hold-must-never-silently-revoke-an-operator-review-/)'s code had landed
(PR #1124, merged `2026-08-09T11:50:32Z`) 30 minutes earlier — that is the fix working in production, and it is
why `#3039` is resolved rather than a slice here. It made the revocation **loud**; it did not make it
**wrong-free**.

### The PR #1106 measurement, re-derived — and one circulating number corrected

`#3046` filed its byte measurement as explicitly single-sourced and unreplicated. It has now been re-derived by
script from the real commits (`git diff <merge-base(main-tip, head)> <head>`, the same basis
`computeNetDiffText` in [we:scripts/merge-ai-prs.mjs](scripts/merge-ai-prs.mjs) uses), and the derivation is
self-certifying: the accept-time net diff reproduces **both** stamped markers from the `2026-08-09T00:33:59Z`
clearance comment exactly — `reviewed-diff 3265beec…` and `reviewed-contribution b5d1eafe…` — which proves the
base reconstruction is the right one.

- accept-time — main `926c3471`, head `53b37954`, merge-base `543b9962` → **141,836 bytes**,
  contribution digest `b5d1eafe…` (matches the stamp)
- post-rebase — main `7a58229f`, head `e97d6c3b`, merge-base `7a58229f` → **141,836 bytes**,
  contribution digest `e7b1d883…` (**diverged**)

**The "137,799 bytes" figure that circulated with this incident is wrong.** Both net diffs are 141,836 bytes,
identical to each other. Everything else in the original measurement replicates exactly: 1,534 projection lines
on each side, differing in precisely two, both of them inter-hunk gap values —
`~424 → ~439` (`panelRigorFromReasons`) and `~324 → ~328` (`runComment`) — so `main` grew 15 lines above one hunk
and 4 above another, a non-uniform move. No `+`/`-` line, hunk length, section heading or file differs.

## Slices

| slice | direction | owns |
| --- | --- | --- |
| [#3021](/backlog/3021-the-contribution-fingerprint-still-collides-on-an-intra-sect/) | digest **converges** | false **honour** — two different contributions hash alike when a relocation preserves heading + gap |
| [#3046](/backlog/3046-a-stale-acceptance-re-park-fires-on-an-unchanged-contributio/) | digest **diverges** | false **stale** — the inter-hunk **gap** is variant under a non-uniform base move |
| `#3052` | digest **diverges** | false **stale** — the section **heading** is variant when the base inserts a new column-0 declaration |
| [#2884](/backlog/2884-acceptance-coverage-keys-on-head-sha-identity-so-a-no-op-reb/) | the caller | `acceptanceCoversHead` keys on head-SHA identity; the "self-corrects on a fresh accept" clause fails when the drain is what moves the head |

## The joint constraint no slice may break

`#3021` pins its residual with a deliberately-passing test ("THE KNOWN RESIDUAL, pinned") in
[we:scripts/lib/review-escalation.mjs](scripts/lib/review-escalation.mjs)'s unit suite. Whichever direction is
taken, that pin and the false-stale reproductions must be updated in the **same** change — the digest's residuals
must never be allowed to disagree about what it promises. `#2884`'s definition of done (a parked PR with a valid
acceptance converges to a land with no operator valve, under a drain that rebases it on unrelated `main` traffic)
is the acceptance bar for the umbrella as a whole, not just for that slice.

## What is deliberately NOT in scope here

**Which label a stale re-park applies** is a different layer and a live design fork — it is carved to `#3053`
(this epic `blockedBy` it), with the build side kept at
[#3024](/backlog/3024-a-stale-acceptance-re-park-re-asserts-review-human-from-the-/). That fork's first question is
how much of its hole survives once the false stale stops firing, which is why it gates this epic rather than
sitting inside it.

Related: [#3023](/backlog/3023-a-drain-re-score-revokes-a-human-clearance-a-content-preserv/) (the parent whose
PR #1119 built the contribution escape, resolved),
[#2409](/backlog/2409-gate-check-a-pr-s-reviewed-commit-set-must-match-its-head-be/) (the ratified
SHA-identity tradeoff, resolved),
[#2198](/backlog/2198-lander-rebase-drops-the-transient-lane-manifest-on-land/) (the rebase-drop that moves the
head, resolved).
