# Backlog split analysis — 2026-07-05 (focused: #2285)

Focused `/slice 2285`. #2285 *"Negotiated agent review for the drain"* is an **epic, already
partially sliced**: child [#2286](/backlog/2286-v1-review-human-classifier-single-reviewer-auto-review/)
(v1) is `resolved`, while **v2** and **v3** are fully described in the epic body but were never filed as
cards. Net effect on the board: the epic shows only a resolved child (a misleading *all slices done*
state) and the remaining two stages sit buried in prose, unclaimable and off the burndown. The slice work
is to **finish the decomposition** — carve v2 and v3 out into their own child stories.

## Work-investigation pass

The v1 ceremony is live, so v2/v3 modify a surface that exists (not a guess-from-the-body):

- The `/drain` auto-review ceremony — [we:skills-src/drain/SKILL.md:111-145](skills-src/drain/SKILL.md#L111-L145).
  Step 3 today: a `changes` verdict → `--add-label review:changes` → routes the fix **back to the author
  lane** ("v1 does **no** drain-side editing; that convergence loop is v2").
- The escalation classifier — [we:scripts/lib/review-escalation.mjs](scripts/lib/review-escalation.mjs)
  (`isGateSelfPath`, `humanRequired`, `decideReviewGate`).
- The lander — [we:scripts/merge-ai-prs.mjs](scripts/merge-ai-prs.mjs) (emits the `parked` array the skill
  routes on).
- Both new stages compose on the **Workflow orchestrator** (deterministic loop-until-agreement / reviewer
  fan-out) and `/code-review`'s dimensions (the v3 mandate lenses) — named in the epic body, both real.

Each stage is a single coherent feature (~`size 5`), not a multi-story scope → **story slices, not
sub-epics**.

## Could split — #2285 (2 new slices)

| Slice | kind / size | Scope | Blocked by |
|---|---|---|---|
| **v2** — editor↔reviewer negotiation loop | `story` / 5 | Replace v1's author-bounce (`review:changes` → author lane, [we:skills-src/drain/SKILL.md:128-137](skills-src/drain/SKILL.md#L128-L137)) with a bounded **convergence cycle**: an editor agent proposes a fix, the reviewer agent critiques, iterate until accept or an **N-round cap**; non-convergence → `review:human`. Composes on the Workflow orchestrator. Final state is reviewer-approved → #2285 invariant holds. *Settle at spec:* round-cap N; where the editor writes (lane clone vs. direct push). | #2286 (v1, ✓ resolved) |
| **v3** — multi-mandate reviewer panel | `story` / 5 | Extend v2's single reviewer into a **panel** of distinct mandated reviewers (correctness / security / simplicity / standards-conformance — the `/code-review` lenses), fanned out via the Workflow orchestrator. **Unanimous** accept → land; any mandate conflict (security wants X, simplicity wants not-X) or non-convergence → `review:human` (a mandate tradeoff is human judgment by definition). | v2 |

**Slice DAG (incremental-delivery chain):** `#2286 (v1 ✓) → v2 → v3`

**Rubric verdict — all five hold:**

1. **Volume, not uncertainty.** No buried fork — the mechanism of each stage is decided in the epic body
   (iterate-to-convergence; unanimous-panel). What remains are *tuning knobs* (round cap, editor write
   location) that settle at spec, exactly like #2171's "to settle when specing" notes — not blocking forks.
2. **≥2 nameable slices, each a real home.** v2 and v3, each an independently valuable `story` under the
   epic.
3. **Slices land small.** Each re-estimates to `size 5`, named files `file:line`-grounded above.
4. **Clean DAG with real independence.** A linear chain, permitted here because it unlocks **genuine
   incremental delivery**: v1 already shipped and is valuable alone; v2 (drain auto-fixes instead of
   bouncing) ships valid alone; v3 (panel replaces single reviewer) ships valid alone. Each is a usable
   increment, not "nothing works until the last."
5. **No coherence loss — every slice leaves a valid, demoable state.** Each stage leaves the drain ceremony
   coherent and the #2285 invariant intact; proven by unit tests + the ceremony doc (the same proof bar v1
   met — this is drain tooling, not a standards feature, so the fixture-driven-demo DoD doesn't apply).

**Batchable:** **v2 is unblocked now** (its only blocker #2286 is resolved) → immediately batchable. v3 is
blocked by v2 → batchable once v2 lands.

## Could not split

None. The focused candidate splits cleanly.

## Net

`+2` slices under #2285 (v2, v3); the epic stays an epic (already sliced, no conversion), and its residual
board state corrects from *all slices done* → *open slices*. #2285 already carries no `size`, so no residual
to drop.
