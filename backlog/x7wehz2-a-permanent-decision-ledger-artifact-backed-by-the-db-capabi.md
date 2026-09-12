---
kind: story
size: 3
status: open
blockedBy: ["3277"]
dateOpened: "2026-09-07"
tags: []
---

# The "Decision Board": a permanent Artifact, backed by the db capability, that records ratified decisions durably

A published Artifact page -- named **"Decision Board"** -- that permanently records RATIFIED decisions --
which fork/option was chosen, who decided, when, why -- as durable db-capability documents (e.g.
decisions/<id>/rulings/<id>), queryable later via read_db. Not a view of what is pending; a durable audit
trail scratch files and chat history do not have. Distinct from we:backlog/3277-declare-an-operation-that-publishes-and-refreshes-a-decision.md
(the publish/refresh operation, rendering-focused). **RATIFIED (2026-09-07):** this ledger and the
top-5-leverage decision docket (the "what to decide" surface, being filed separately -- cross-reference its
number here once it lands) publish to the SAME Artifact, as two sections of one page -- see "Ratified
design" below.

## Origin (2026-09-06/07, the operator's own words)

The operator asked whether an Artifact can have a "backend" so it can leave a trace of decisions directly
in it, as a precursor to a future review surface. It can: the Artifact tool's `db` runtime capability
(`capabilities: {db: {}}`) gives a published page a shared, realtime JSON document store -- any viewer's
writes land in a collection, and a session can also read/write it via the Artifact tool's `read_db`/`write_db`.
Concretely: when someone rules on a decision fork (approves, rejects, picks an option), the page itself
writes a doc -- e.g. `decisions/<decisionId>/rulings/<rulingId>` with actor, timestamp, choice, rationale --
directly from a button/form on the page, no separate backend needed. `scratchpad/pr-*-clearance.md` is the
closest existing analog of what gets captured (the clearance-note style rationale already used tonight for
PR clearances), but a scratch file dies with the session; this record is durable, structured, and queryable
back later.

## What was checked first (standing discipline)

- we:backlog/3277-declare-an-operation-that-publishes-and-refreshes-a-decision.md -- declares an operation
  for PUBLISHING/REFRESHING a decision or architecture artifact (rendering-focused: keep the page a ruling is
  read from in sync as the decision moves). It says nothing about the page writing back a record of what was
  ruled. Related, not a duplicate.
- A companion "keep the top-5 highest-leverage OPEN decisions continuously prepared and shown with full fork
  detail" item was expected to already exist from earlier the same session (a "what to decide" docket, as
  opposed to this item's "what WAS decided" ledger) but a thorough backlog search (title/body grep for
  leverage/docket/monitor/top-5/highest-leverage, files opened 2026-09-06/07, the #3029 epic's own child
  list) did not turn one up as of this item's filing. The operator has since confirmed a sibling agent is
  filing it and ratified that it shares this same "Decision Board" Artifact -- see "Ratified design" below
  for the up-to-date relationship; it had still not landed as of this update, so its number is not yet
  filled in here.
- `grep -rl "capabilities.*db\|claude.use(\"db\")"` across the repo: only we:backlog/204 (an unrelated
  capability-vocabulary matrix) and an unrelated agent-memory file matched. No existing use of the Artifact
  `db` capability in this repo. Confirmed genuinely new.

## Ratified design (2026-09-07, operator)

The fork raised at filing time -- same artifact as the pending-decisions docket vs. a separate page -- is
**closed**: they publish to the **same Artifact**, as two sections of one page, per the operator's own
ruling (ruling in place beats a context switch, the reasoning this item's own recommended default already
gave). The shared page is named **"Decision Board"** -- neither "docket" nor "ledger" alone describes it
once it carries both halves (what to decide + what was decided), so this is the one name both this item and
its sibling should use going forward, not a placeholder.

- **"Decision Board" = one Artifact, two sections:**
  - *Docket section* -- the top-5 highest-leverage OPEN decisions, continuously prepared and shown with
    full fork detail. Owned by the sibling item below (not this one) -- filed separately, not yet landed as
    of this update. **Cross-reference: the top-5-leverage docket item, once it lands, is the sibling half of
    this same Board** -- add its number here when it is filed (search for it again before building either
    half, since a search at filing time did not find it).
  - *Ledger section* -- this item's own scope: the durable record of RATIFIED decisions, described below.
- Both sections read/write the same page's `db` capability; the docket's pending-fork collection and the
  ledger's `decisions/*/rulings/*` collection coexist without conflict (different collection paths, no
  shared keys).
- Neither section blocks the other's initial build -- they land as separate items against the same target
  page -- but whichever lands first should declare the page's `capabilities: {db: {}}` and its "Decision
  Board" title/shell, so the second item extends rather than re-publishes it.

## Scope (build-ready)

- Declare `capabilities: {db: {}}` on the published "Decision Board" page (per
  we:.claude/skills/artifact-capabilities) -- or extend it, if the docket sibling publishes the page shell
  first.
- A ruling form/button per open fork writes `decisions/<decisionId>/rulings/<rulingId>` with `actor`,
  `timestamp`, `choice`, `rationale` -- the clearance-note fields already used tonight, structured instead of
  prose.
- The record is append-only from the page's own writes (no viewer overwrites another's ruling) and readable
  back via `read_db` by a later session -- the property scratch files and chat history don't have.
- If we:backlog/3277-declare-an-operation-that-publishes-and-refreshes-a-decision.md has landed by the time
  this builds, the page's publish/refresh goes through that declared operation rather than a hand-rolled
  Artifact-tool call, per the repo's never-hand-roll-what-is-declared discipline.

## Done when

1. **Executable** -- TODO: once the artifact exists, `read_db` on `decisions/<id>/rulings` returns a ruling
   doc written by an actual button/form action on the published page (not seeded by hand), proving the
   round-trip: page write → durable store → session read-back.
