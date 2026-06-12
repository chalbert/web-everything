---
name: prepare-decision-item
description: Take an un-prepared open decision and do the research + authoring that brings its forks to the "Definition of Ready" — so the eventual decision turn is fast ratification, not cold research. Pure agent work (no human judgment): surveys prior art, publishes a /research/ topic, states each fork's options + bold default, then sets preparedDate so readiness tags it "✓ ready to ratify". Use when the user wants to "prepare" a decision, get a fork ready to decide ahead of time, or pre-research an open design call. To MAKE a prepared call, use /next decision instead.
---

# Prepare — bring an open decision to "ready to ratify", ahead of the call

Trigger + pointer — the method lives in
[docs/agent/backlog-workflow.md](../../../docs/agent/backlog-workflow.md): **"Fork-readiness pass"**,
**"Per-fork classification pass"**, and **"The prepared-fork shape — a decision's Definition of
Ready"**, which lean on [design-first.md](../../../docs/agent/design-first.md) (step 1 prior-art survey)
and [research-workflow.md](../../../docs/agent/research-workflow.md) (publishing a `/research/` topic).
Don't restate the rubric here; if the method changes, edit those docs.

The line that defines this skill: **prep is the autonomous half of a decision** — the research +
authoring that can be done *ahead* of the call, with **no human judgment yet**. It does **not** make
the call. When prep is done the item is still `open`; it just carries `preparedDate`, so
`check:readiness --select` ranks it **prepared-first within Tier B** and tags it `✓ ready to ratify`
(vs `○ needs prep`), and `/next decision` later surfaces it as a fast ratification rather than a cold
research dump. To *make* a prepared (or un-prepared) call, that's `/next decision`, not this.

## Quick path — the loop in commands

1. **Build the candidate set — un-prepared open decisions.** `npm run check:readiness -- --select
   --json` → take **Tier B** items where `preparedDate` is null (the `○ needs prep` ones). **Blocked
   (Tier C) decisions aren't in that projection**, so also one-pass scan `backlog/*.md` for
   `type: decision`/`review` + `status: open` + no `preparedDate`. `/prepare <NNN>` (or `<NNN-slug>`)
   focuses one item — skip ranking, go to step 3. Bare `/prepare` ranks the set.
2. **Rank by downstream-unblock leverage and recommend one** (same rule as *When nothing is
   agent-ready* → most dependents wins; tie-break smaller fork first). Present a short shortlist (top
   3–5, one-line rationale + leverage each) with two links per item ([live] · [md]) and your
   recommended pick. Prep is a real token spend (a prior-art survey + a `/research/` topic + authoring),
   so get **one "go"** on which item before burning it — *not* a multiple-choice; planning-as-discussion.
3. **Claim it.** `node scripts/backlog.mjs claim <NNN>` (race-safe `open → active` + `dateStarted`;
   refuses if dirty or already taken). Emit the rename slug. Claiming guards against a concurrent
   session preparing the same fork — prep is claimable work like any other.

## Doing the prep — the three passes, in order

Run the three documented passes on the claimed item, **editing the item on disk** (not just chat) — the
durable output is the rewritten body, not a message:

1. **Prior-art research first — never author a fork cold** (*Fork-readiness pass* → first bullet). If
   the decision authors/designs anything greenfield (a new intent/block/plug/protocol/adapter, or any
   "no design exists yet" call), run [design-first.md](../../../docs/agent/design-first.md) step 1:
   survey browser standards (MDN/WHATWG/W3C/WAI-ARIA APG) + the `references.json` benchmark libraries,
   reuse platform vocabulary, and **publish the findings as a `/research/` topic** — a
   `researchTopics.json` entry + `src/_includes/research-descriptions/{id}.njk` write-up
   ([research-workflow.md](../../../docs/agent/research-workflow.md)) — keeping the session
   `reports/{date}-{slug}.md` as the artifact and linking it via `relatedReport`. A decision over
   already-researched ground just links the prior report; one that only ratifies shipped code skips the
   web survey but still needs the concrete-refs check. **Research reshapes the forks — expect it to add
   or dissolve a fork** (#64 gained Fork 4 from its survey); a pass that only confirms the existing
   framing means the survey was too shallow.
2. **Per-fork classification pass** — run the fixed 7-question sequence (which layer? · protocol or
   intent dimension? · expose the whole axis? · fixed mechanic or dimension? · DI-injectable? · most-
   permissive default? · seam between intents?) on **every** element, and record the classification in
   the item — it *is* much of the eventual ruling. Honour the standing bias: **separate and decouple**
   (burden of proof is on combining).
3. **Author the prepared-fork shape** (*The prepared-fork shape*) — rewrite the body to all of:
   a **digest that declares the grounding** (no design exists yet · N forks grounded in the published
   `/research/` topic · each carries a **bold** recommended default); an **axis-framing paragraph**
   decomposing the concern into orthogonal axes, each pinned to **concrete `file:line` refs into the
   real tree** (go read the code, cite it — an authored snippet never substitutes); a **"recommended
   path at a glance" preview table** (one row per fork: *recommended default · main alternative ·
   confidence* — confidence flags where judgment is actually needed); and **one `## Fork N` section per
   open fork** (crux-with-refs → options **A/B/…** named with tradeoffs → **bold** default → *Rejected*
   branches with reason → any sub-decision).

## Close out — mark prepared, release back to open

A prepared decision is **still open** — the call hasn't been made. So:

1. **Set `preparedDate: "YYYY-MM-DD"`** (today) in the item's frontmatter via an Edit — this is the
   one flag that makes readiness rank it `✓ ready to ratify`.
2. **Gate:** `npm run check:standards` green (and the new `/research/` topic renders — confirm the
   `researchTopics.json` entry + `.njk` write-up parsed). Confirm a `relatedReport` link exists.
3. **Release the claim:** `node scripts/backlog.mjs release <NNN>` (`active → open`; stamps untouched,
   so `preparedDate` survives). **Do not `resolve`** — resolving is the *decision* turn's job, not
   prep's.
4. Close with a one-line net-flow note (item `#NNN` now `✓ ready to ratify`, research topic published)
   and point at `/next decision` to make the call when ready.

## Relationship to `/next decision`

Prepare is the **upstream feeder** for decision-mode: it pays the research cost **once, ahead of time**,
so the decision turn (`/next decision`) is a fast ratification of a legible fork instead of a cold
research dump. `/prepare` does the agent work and stops at `open + preparedDate`; `/next decision` makes
the human call and `resolve`s. Run `/prepare` to manufacture ready-to-ratify decisions, then
`/next decision` to ratify them.
