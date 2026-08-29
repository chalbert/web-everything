---
bornAs: x00twdx
kind: decision
status: open
dateOpened: "2026-08-28"
tags: [plateau-loop, delivery, conveyor, observability, operations-engine]
relatedTo: ["3383"]
---

# Derive the delivery-loop flowchart from operations-engine config, instead of hand-maintaining it

The operations engine already declares every operation as a typed step sequence with explicit
inter-step reads — enough structure to auto-render a flowchart, closing the "inspect what the
machinery does" gap the #3383 epic asked for. A separate, bigger question rides alongside it:
whether to go further into a live-editable generic workflow config layer, which risks becoming a
second implementation of the operations engine this repo repeatedly rejects.

## Where this came from

Raised in conversation (2026-08-28, mid-#3383 session) as a reframe of a pattern from a different
project: "a system that worked from declarative config for all steps so that a full flow chart
could be derived from the code itself... separate the workflow system from the current workflow
and can expose a doc page and modify the flow based on config live with preview for user to see."

Discussed, not built — this card exists so the idea has a home other than a chat transcript.

## Not yet prepared — for `/prepare` to pick up

Neither branch below has been through the standing test, per-fork classification, prior-art
research, or a skeptic pass. What follows is the shape of the two questions as raised in
discussion, not a prepared fork — `/prepare` should treat this as a fresh claim, not a stamp to
trust.

**Candidate question 1 — build the read-only derived diagram?** The operations engine
(`we:scripts/operations/registry.mjs`, `we:scripts/operations/engine.mjs`) already declares each
operation as `compute`/`judge`/`confirm`/`effect` steps with explicit `reads: [...]` dependency
edges between them — structurally a DAG already. A renderer walking `OPERATIONS`
(`we:scripts/operations/run.mjs`) plus each declaration's steps could auto-produce a flowchart
(Mermaid, or a rendered doc page) with no new engine, no new config format — a pure projection over
data that already exists. Low apparent risk, directly serves #3383's own "inspect and diagnose"
requirement, and is already listed as a known-but-unbuilt gap in the #3383 delivery-loop artifact.

**Candidate question 2 — go further into a live-editable generic workflow config layer?** The
bigger version of the idea: expose the flow as editable config, not just a rendered diagram, with
live preview. This is where the risk concentrates. This repo has repeatedly and explicitly
rejected a second implementation of something that already exists in one place — reinforced at
least three times in the #3383 session alone (a second spawn runner, a second conducting agent, a
second Node port of dispatch logic). A standalone generic workflow engine sitting next to the
existing operations engine risks being exactly that shape of mistake. And "live-editable" cuts
against this codebase's whole discipline so far: every mechanical behavior here is declared in
code, reviewed via PR, landed through a lane — a runtime config surface that changes behavior
outside that path would be a real governance regression relative to everything else built here,
unless "live" turns out to mean "edit a config file that still goes through review," which is a
very different, much smaller claim than "change behavior at runtime."

**The likely shape, unattacked**: candidate question 1 is probably a straightforward yes; candidate
question 2 is probably either "no, not now" or "yes, but only as a nicer authoring surface over
the existing engine, still PR-gated" — never a parallel runtime-editable engine. This is a guess
formed in discussion, not a prepared recommendation — treat it as the starting hypothesis for prep
to attack, not the answer.

## Done when

1. Standing test run on both candidate questions above — confirm they're real forks (or dissolve/
   merge them if they're not).
2. Prior art surveyed: how the operations engine's own `reads:` edges map to a renderable graph,
   and whether any existing tool in this repo already does partial diagram generation.
3. A recommended default authored for each surviving fork, red-teamed by a skeptic sub-agent per
   the `prepare-decision-item` skill.
4. `preparedDate` stamped once both are at Definition of Ready — this card is explicitly NOT ready
   to ratify as filed; it is a claim for `/prepare` to research, not a decision to ratify cold.
