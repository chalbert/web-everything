# Backlog consolidation analysis — 2026-08-09

Scope: the five open cards orbiting the 2026-08-09 clearance-revocation incident on WE PR #1106 and WE PR #1100
— #3046, #3021, #3024, #3039, #2884. Run per *Consolidating related items* in
[we:docs/agent/backlog-workflow.md](../docs/agent/backlog-workflow.md). The instruction recorded on #3046 was
"run them through `/consolidate` and decide whether they want an umbrella epic — do that before claiming this
card, not after."

## What each card actually owned, established by reading the code

| card | direction | owns | verified against |
| --- | --- | --- | --- |
| #3021 | digest **converges** | false **honour** — two different contributions hash alike when a relocation preserves the `@@` heading and the inter-hunk gap. Its argument depends on the gap being *preserved* under a uniform shift. | `normalizeContributionFingerprint` docblock, `THE RESIDUAL` block, [we:scripts/lib/review-escalation.mjs](../scripts/lib/review-escalation.mjs) |
| #3046 | digest **diverges** | false **stale** — the inter-hunk **gap** is variant under a *non-uniform* base move, so a byte-identical contribution re-parks. | docblock lines 891–893; measurement re-derived by script (below) |
| #3024 | the **label**, not the firing | which label a *genuine* stale re-park applies — whole-PR score vs uncovered-delta score. Needs **ratification** (statute edit), not an impl call. | `decideReviewGate` stale branch, line 1409 ff. |
| #3039 | the **notice** | makes a revocation **loud**, never impossible. Code landed PR #1124, merged `2026-08-09T11:50:32Z`. | all four symbols resolve; notice observed in production on PR #1100 at `12:20:59Z` |
| #2884 | the **caller** | `acceptanceCoversHead` keys on head-SHA identity; the ratified "self-corrects on a fresh accept" clause fails when the drain is what moves the head. Its DoD is **convergence**, and its option 2 ("don't rebase a PR carrying a live acceptance") is a fix no other card has. | PR #983 livelock, 2026-08-02, five re-parks |

## Could consolidate

| cluster | outcome | what changed |
| --- | --- | --- |
| #3021 + #3046 + #2884 + (new) `x0pfbqp` | **Umbrella** `x5p1xz8` — *The acceptance-coverage digest re-parks a cleared PR whose contribution never changed* (`kind: epic`, no `size`, no `scope`) | each member gains `parent: x5p1xz8`; each keeps its `NNN`, `size`, `scope`, body and CTA. No scope merged. |

Rubric, all five conditions checked:

1. **One job, not one topic** — hold. All four rewrite the same function's position signals or the caller that
   reads them, and three of the four bodies already state they cannot be fixed independently. #2884's option 3
   ("auto-re-stamp on a provably-identical rebase") appears verbatim as a direction on both #3021 and #3046.
2. **No decision merged away** — held only *after* carving. The live fork was carved to `xxdslno`; the epic
   `blockedBy` it and narrates no fork inline.
3. **Every member independently claimable** — hold. Sizes and scopes untouched.
4. **No size laundering** — hold. Epic with four sized children; the epic itself carries no points.
5. **Nothing loses its home or CTA** — hold. Nothing renumbered, deleted or resolved by the grouping.

## Left apart

| item | rubric condition that failed | action that would make it groupable |
| --- | --- | --- |
| #3024 | (1) *one job, not one topic* — after the fork is carved, what remains is a **statute-gated build** on `decideReviewGate`'s label choice plus the statute layer, a separately-demoable deliverable at a different layer from the digest. | ratify `xxdslno`. If it rules for the delta-only score, re-run the cluster: the remaining build may then be a real sibling of the digest work. |
| #3039 | not a fold or a group — **delivered**. | n/a; resolved on the evidence below. |

## Fold candidates

**None.** No member's scope sits entirely inside another's — each of the five owns a distinct mechanism or
layer, checked line by line. This matters because folding would have been **blocked anyway**: the retirement
mechanism is itself an unresolved, unprepared decision
([#2982](../backlog/2982-how-a-folded-duplicate-backlog-item-retires-foldedinto-point.md)), and until it
resolves `/consolidate` reports fold candidates and mutates nothing. There is at present **no sanctioned way to
mark a backlog card superseded** — `resolve` means *delivered* and would book unearned burndown points, and
`parkedReason: superseded` was retired in the 2026-06-22 sweep.

## New items opened

| id | kind | why |
| --- | --- | --- |
| `x5p1xz8` | epic | the umbrella above |
| `xxdslno` | decision | the carved three-way fork (see below) |
| `x0pfbqp` | story, size 2 | a **second false-stale mechanism no card owned** (see below) |

## The design fork flagged, not resolved — `xxdslno`

Three mutually-weakening approaches to one hole, each proposed independently, none ruled:

- **A — keep the whole-PR score.** Status quo, fail-closed, ratified today. Stands until this resolves.
- **B — score only the uncovered delta.** #3024's proposal. Hard case: a head advance that *moves* a leash-path
  edit rather than adding one.
- **C — a fourth `review:stale` hold tier.** Neither operator-only nor agent-clearable. The only option that
  makes the revocation *impossible*. Cost quoted at ~10 label consumers plus the policy contract — **that figure
  is unreplicated** and counting it is prep owed.

They are not complementary: a new tier removes much of the reason to re-score the delta, and a delta-scored
re-park removes much of the reason for a new tier. And the reconciliation is really **three-way**, because both
B and C assume the #1106 re-park was *correct* — it was not. The decision's first question is therefore *how
much of this hole survives once the false stale stops firing.* Left unprepared (no `preparedDate`) with a
provisional, explicitly-attackable default; not ruled here.

## The dangling deferral, resolved

#3039 stated the `review:stale` fourth tier was "filed separately rather than smuggled in here." It was not — a
grep of every item in `we:backlog/` for `review:stale` and "hold tier" returned only that sentence. Per the
operator's direction it was **folded into `xxdslno` as option C** rather than filed as a sixth card on one
hole. #3039's body now records that.

## What none of the five owned — `x0pfbqp`

A **second** false-stale mechanism, found while verifying the incident and independent of #3046's gap:

git's `xfuncname` picks the nearest preceding column-0 declaration as the `@@` section heading, so when `main`
**inserts a new top-level declaration** above an unmoved hunk, the heading changes and the digest diverges on a
byte-identical contribution. The docblock claims the heading "travels WITH the code rather than with the base,
so `main` inserting lines above does not change it", and anticipates only a **rename** as the base-driven
failure. Insertion is unanticipated and far more common.

Observed on WE PR #1100, `2026-08-09T12:20:57Z` — cleared 52 seconds earlier. Re-derived by script: 1,542
projection lines each side, exactly two differing, **zero** differing `+`/`-` lines. In
`we:scripts/__tests__/review-set-label.test.mjs`:

```
- @@ -1124,3 +1131,186 @@ exit 0
+ @@ -1155,3 +1162,186 @@ describe('#xmnl36p — clear-human stamps a clearance the re-score reader can fi
```

The `describe(…)` block was inserted by **PR #1124 — #3039's own landing**, 30 minutes earlier. The second
differing line is a gap (`~23 → ~29`), so #1100 exhibits *both* mechanisms and a gap-only fix would not have
saved it.

## Measurements re-derived — one circulating figure corrected

Basis: `git diff <merge-base(main-tip, head)> <head>`, matching `computeNetDiffText` in
[we:scripts/merge-ai-prs.mjs](../scripts/merge-ai-prs.mjs). Self-certifying for #1106 — the accept-time net diff
reproduces both markers stamped in the `00:33:59Z` clearance comment exactly.

| PR | side | main tip | head | merge-base | bytes | contribution digest |
| --- | --- | --- | --- | --- | --- | --- |
| #1106 | accept | `926c3471` | `53b37954` | `543b9962` | 141,836 | `b5d1eafe…` (= the stamp) |
| #1106 | post-rebase | `7a58229f` | `e97d6c3b` | `7a58229f` | 141,836 | `e7b1d883…` |
| #1100 | accept | `a68b4902` | `afcbd8d5` | `f761c7cd` | 132,109 | `6a4f7c53…` |
| #1100 | post-rebase | `a68b4902` | `e6511618` | `a68b4902` | 132,196 | `b8dd7351…` |

**The "137,799 bytes" figure that circulated with this incident is wrong** — both #1106 net diffs are 141,836
bytes. It was single-sourced to the PR #1124 review's by-hand recomputation and #3046 had already flagged it as
unreplicated; it is now retired from #3046 and #3039. Everything else in that measurement replicates exactly.

Note on #1100: its raw byte counts *differ* (87 bytes), entirely in the parts the digest drops — absolute `@@`
offsets, context lines, `index` blob pairs. The projection differs in two lines only and no `+`/`-` line at all.
A reviewer checking by `wc -c` on the raw diff would wrongly conclude the contribution changed.

## Net flow

`+1 epic`, `+1 decision`, `+1 story`; 3 members re-parented; 1 member left apart with a `blockedBy` edge to the
carved decision; 1 member resolved on delivery evidence; 1 cluster grouped, 0 folded.
