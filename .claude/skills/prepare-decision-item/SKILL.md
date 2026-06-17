---
name: prepare-decision-item
description: Take an un-prepared open decision and do the research + authoring that brings its forks to the "Definition of Ready" — so the eventual decision turn is fast ratification, not cold research. Pure agent work (no human judgment): surveys prior art, publishes a /research/ topic, states each fork's options + bold default, then sets preparedDate so readiness tags it "✓ ready to ratify". Use when the user wants to "prepare" a decision, get a fork ready to decide ahead of time, or pre-research an open design call. To MAKE a prepared call, use /next decision instead.
---

# Prepare — bring an open decision to "ready to ratify", ahead of the call

Trigger + pointer — the method lives in
[backlog-workflow.md](../../../docs/agent/backlog-workflow.md): *backlog-workflow.md → Fork-readiness
pass*, *backlog-workflow.md → Per-fork classification pass*, and *backlog-workflow.md → The
prepared-fork shape*, which lean on *design-first.md → step 1 prior-art survey* and *research-workflow.md
→ publishing a /research/ topic*. Don't restate the rubric here; if the method changes, edit those docs.

Prep is the autonomous **half of a decision** — the research + authoring that can be done *ahead* of the
call, with no human judgment yet. It does *not* make the call; that's `/next decision`. When prep is done
the item carries `preparedDate`, so `check:readiness --select` ranks it prepared-first within Tier B and
tags it `✓ ready to ratify` (vs `○ needs prep`).

## Quick path — the loop in commands

1. **Build the candidate set — un-prepared open decisions.** `npm run check:readiness -- --select
   --json` → take Tier B items where `preparedDate` is null (the `○ needs prep` ones). Blocked (Tier C)
   decisions aren't in that projection, so also one-pass scan `backlog/*.md` for
   `type: decision`/`review` + `status: open` + no `preparedDate`. `/prepare <NNN>` (or `<NNN-slug>`)
   focuses one item — skip ranking, go to step 3. Bare `/prepare` ranks the set.
2. **Rank by downstream-unblock leverage and recommend one** (same rule as *When nothing is
   agent-ready* → most dependents wins; tie-break smaller fork first). Present a short shortlist (top
   3–5, one-line rationale + leverage each) with two links per item ([live] · [md]) and your
   recommended pick. Prep is a real token spend (a prior-art survey + a `/research/` topic + authoring),
   so get one "go" on which item before burning it — *not* a multiple-choice; planning-as-discussion.
3. **Claim it.** `node scripts/backlog.mjs claim <NNN> --as=preparing` (race-safe `open → preparing`
   + `dateStarted`; refuses if dirty or already taken). The `preparing` status drops it from selection
   exactly like `active`, but reads distinctly on the `/backlog/` board — a decision being *researched*,
   not a story mid-build (#375). Emit the rename slug. Claiming guards against a concurrent session
   preparing the same fork.

## Doing the prep — the passes, in order (standing test first)

Run the documented passes on the claimed item, editing the item on disk (not just chat) — the durable
output is the rewritten body, not a message:

0. **Standing test FIRST — is each concern even a fork?** (*backlog-workflow.md → Standing test before
   any of the above — is this even a decision?*). Run the fork-existence test on every concern: a real
   fork exists only if exactly one branch is correct and the alternative is *broken* (forced invariant →
   ratify), or two coherent branches genuinely *cannot* coexist. If you can't name the broken/excluded
   branch, there is no fork — author it as a "Supported by default" entry, never a `## Fork N` with a pick.
   (The #756 miss: A and B were composable from one `traitEnforcerParcel` factory, so the call was
   *support both, default to the factory*.)
1. **Prior-art research first — never author a fork cold** (*backlog-workflow.md → Fork-readiness pass*,
   first bullet). If the decision designs anything greenfield (a new intent/block/plug/protocol/adapter,
   or any "no design exists yet" call), run *design-first.md → step 1*: survey browser standards
   (MDN/WHATWG/W3C/WAI-ARIA APG) + the `references.json` benchmark libraries, reuse platform vocabulary,
   and publish the findings as a `/research/` topic — a `researchTopics.json` entry +
   `src/_includes/research-descriptions/{id}.njk` write-up (*research-workflow.md*) — keeping the session
   `reports/{date}-{slug}.md` as the artifact and linking it via `relatedReport`. A decision over
   already-researched ground just links the prior report; one that only ratifies shipped code skips the
   web survey but still needs the concrete-refs check. Research reshapes the forks — expect it to add or
   dissolve a fork (#64 gained Fork 4 from its survey); a pass that only confirms the existing framing
   means the survey was too shallow.
2. **Per-fork classification pass** — run the fixed 7-question sequence (which layer? · protocol or
   intent dimension? · expose the whole axis? · fixed mechanic or dimension? · DI-injectable? · most-
   permissive default? · seam between intents?) on every element, and record the classification in the
   item — it *is* much of the eventual ruling. Honour the standing bias: separate and decouple (burden of
   proof is on combining).
3. **Author the prepared-fork shape** (*backlog-workflow.md → The prepared-fork shape*) — rewrite the
   body to that shape. WE-specific reminders: pin each axis to concrete `file:line` refs into the real
   tree (go read the code, cite it — an authored snippet never substitutes); **open every `## Fork N`
   with its one-line fork-existence justification (#819)** — name the *flawed/excluded* branch (forced
   invariant) or *why the coherent branches genuinely cannot coexist* (real either/or); a fork that can't
   produce that line is a pass-0 miss, dissolve it to "Supported by default" rather than stamp over it.
   Only genuine forks get a
   preview-table row — support-both concerns from pass 0 go in the "Supported by default" list, not the
   table. A row whose "main alternative" isn't actually *excluded* is a pass-0 miss — demote it. Author
   the default to survive a red-team (*backlog-workflow.md → Red-team the default*): at ratify time the
   decider argues the alternative + names the principle the default violates, so ground the default's
   rationale against the real tree now and flag high-leverage forks for the deciding agent's skeptic
   sub-agent pass; prep that only *asserts* a default leaves the attack to land at decision time.

## Close out — mark prepared, release back to open

A prepared decision is **still open** — the call hasn't been made. So `release`, don't `resolve`:

1. **Gate before stamping — every fork must actually be at DoR, *including* the one you'd rather leave
   "for the human."** Prep's whole job is to bring the human-judgment fork to options + tradeoffs + a
   bold recommended default the decider then ratifies or overrides — not to hand the human a raw
   question. A fork you couldn't shape that way is un-prepared, not "deferred": either shape it (it almost
   always can be — even a naming/ownership/scope call gets researched options + a default; see #009's
   "mint `webpush` vs fold the protocol into an existing project" fork), or carve it to a child item that
   is *itself* prepared and rewrite the parent fork to "→ delegated to #NNN (prepared)". A body still
   carrying a bare "needs a human call" / "confirm X" / "TBD" / slash-name (`webpush`/`webpermissions`)
   fork is not prepared — do not stamp it. Walk every `## Fork N` and confirm each has its fork-existence
   justification line (#819), named options,
   tradeoffs, and a bold default. Then set `preparedDate: "YYYY-MM-DD"` (today) in the item's frontmatter
   via an Edit — the one flag that makes readiness rank it `✓ ready to ratify`, so stamping a
   half-prepared item is a false "ready" the next decision turn will trust.
2. **Gate:** `npm run check:standards` green (and the new `/research/` topic renders — confirm the
   `researchTopics.json` entry + `.njk` write-up parsed). Confirm a `relatedReport` link exists.
3. **Release the claim:** `node scripts/backlog.mjs release <NNN>` (`preparing → open`; stamps untouched,
   so `preparedDate` survives). Do not `resolve` — resolving is the *decision* turn's job, not prep's.
4. Close with a one-line net-flow note (item `#NNN` now `✓ ready to ratify`, research topic published)
   and point at `/next decision` to make the call when ready.

## Relationship to `/next decision`

Prepare is the upstream feeder for `/next decision`: it pays the research cost once, ahead of time, so
the decision turn is a fast ratification. Run `/prepare` to manufacture ready-to-ratify decisions, then
`/next decision` to ratify them.
