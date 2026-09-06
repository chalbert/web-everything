# Backlog consolidation analysis — #3006 / #3369 / #3383

**Date:** 2026-09-06 · **Scope:** deliberately *not* a board sweep. Clustered around the three epics whose
file claims the [#3006 split analysis](2026-09-06-backlog-split-analysis.md) found overlapping.

**Verdict: nothing to consolidate. One cluster is already consolidated; the other is blocked by an
unresolved fork.** No mutation proposed.

---

## The tree, before anything

| Item | kind · status | parent | children (open / total) |
|---|---|---|---|
| #2606 | epic | — | — |
| #3029 *Operation engine* | epic · open | #2606 | **73 / 112** |
| #3369 *Decouple agent dispatch* | epic · open | **#3029** | 2 / 2 |
| #3383 *Background mechanical dispatcher* | epic · **active** | **#3029** | 15 / 50 |
| #3006 *Move agent work onto the CLI* | epic · open | **none** | 0 / 0 |

The load-bearing discovery: **#3369 and #3383 are already siblings under #3029.** The umbrella this analysis
was convened to consider *already exists*, and the rubric's own instruction is to reuse an existing epic
rather than mint a sibling. #3006 is the only orphan.

---

## Could consolidate — none

No cluster survives the rubric. Both are recorded below with the condition that failed.

## Left apart

### Cluster 1 — #3369 + #3383: **already consolidated, no action**

Both already roll under #3029. Minting an umbrella over them would create a sibling epic duplicating one that
exists — explicitly forbidden by *Executing a consolidation* step 1 ("**Reuse** an existing epic that already
covers the cluster instead of minting a sibling umbrella"). Nothing to do.

### Cluster 2 — #3006 + {#3369, #3383}: **fails rubric (1) and (2)**

**Fails (1) — one topic, not one job.** Three distinct deliverable outcomes: #3383 replaces the interactive
dispatcher with a mechanical one; #3369 decouples the spawn contract from one provider; #3006 optimises what
CLI-based agent work costs. They share a *topic* (agent dispatch) and, at body level, one *file*. That is
adjacency, and the rubric is explicit that adjacency is not a reason to couple.

**Fails (2) — and this is the blocking one. A decision sits between the members.** #3369 motivates itself
partly on *"every task pays for the same tier of model regardless of how hard it actually is"*; the
[token-optimisation research](/research/token-optimisation-research/) concludes the opposite on the cost axis
— caches are model-scoped, so a cascade forfeits cross-model reuse, and effort-tiering inside one model
measured cheaper at equal quality. That fork is **slice F** in the split analysis, still uncarved.

Rubric (2)'s prescribed action is exactly what the split analysis independently reached from the other
direction: **carve the fork into its own `kind: decision` card, resolve it, then re-run.** Grouping now would
bury under an umbrella the same fork that slicing would have scattered across children.

> Both skills, run independently and pointing opposite ways, converge on the same next action: **F first.**
> That agreement is the strongest signal in either report.

**Unblocking action:** carve F (per the split analysis's staged recipe), ratify it, then re-run
`/consolidate` over these three. If F rules *effort dial*, #3369's cost motivation weakens and its overlap
with #3006 largely dissolves — the two may never need grouping. If F rules *routing*, #3006's remaining cost
scope genuinely belongs inside #3369, and the consolidation becomes obvious.

---

## The `openChildrenCount` check

Requested because re-parenting is how consolidation could arm the unattended auto-resolve documented in the
split analysis ([`we:scripts/backlog/epic-resolve.mjs`](../scripts/backlog/epic-resolve.mjs) lines 65–77,
wired through [`we:scripts/conveyor/pr-watch.mjs`](../scripts/conveyor/pr-watch.mjs)). Both sides of every
move considered:

| Move considered | Source epic (open children) | Destination epic (open children) | Auto-resolve risk |
|---|---|---|---|
| Umbrella over #3369 + #3383 | — (not executed) | — | n/a — no umbrella minted |
| Re-parent #3006 → #3029 | #3006 has **no parent**, so no source epic loses a child | #3029 **73 → 74** | **None.** Destination *gains* an open child, which moves it further from the zero-child trigger |

**No epic is left at zero open children by any move considered, so the hazard does not fire for this
cluster.** Stated plainly rather than assumed — it was the one caveat worth checking before running this, and
it came back clean.

The hazard remains live for **#3006 itself** once slices B and F attach, which is why the split analysis
requires `blockedBy` + `childlessReason: blocked` in the *same edit* as the `size` drop.

---

## Two corrections this analysis produced

**1. The B ↔ #3369 relationship is a `crossRef`, not a `blockedBy`.** The split analysis said B "lands first
or rebases" because `we:backlog/3369-…` line 41 names
[`we:scripts/measure-judge-spawn.mjs`](../scripts/measure-judge-spawn.mjs) among four spawn call sites. But
#3369's two children scope elsewhere — #3370 to `we:scripts/lib/judge-spawn.mjs` +
`we:scripts/operations/cli-adapter.mjs`, #3371 to `we:scripts/lib/judge-spawn.mjs`. **Neither scopes the
harness.** Different files means no dispatcher collision and no real prerequisite, and the rubric is explicit
that a "see also" is a `crossRef`, not an edge. Record it as a crossRef when B is scaffolded.

**2. No open item claims the harness.** A sweep of every card mentioning `measure-judge-spawn` returns
#3028 and #3058 (both `resolved`), #3056 (open, but scoped to `we:scripts/lib/judge-spawn.mjs` and its test),
and #3062/#3064 (open, unscoped, citing it as precedent). **Slice B's scope is genuinely unclaimed** —
confirming the split analysis's one surviving build slice from a second direction.

---

## Net flow

**Zero.** No umbrella minted, no member re-parented, no edge added, nothing resolved. One cluster was already
consolidated before this ran; the other is correctly blocked behind an uncarved decision.

## Open questions registered back to the board

1. **F gates both directions** — it blocks this consolidation *and* is the split analysis's first carve. It
   is now the single highest-leverage next action on this cluster.
2. **#3006 is a parentless epic** whose two closest neighbours sit under #3029. Re-parenting it there is a
   *separate operator judgement*, **not** a rubric-backed consolidation — recorded here so the option is
   visible, explicitly not recommended by this analysis, since rubric (1) says the topic overlap alone does
   not justify coupling.
