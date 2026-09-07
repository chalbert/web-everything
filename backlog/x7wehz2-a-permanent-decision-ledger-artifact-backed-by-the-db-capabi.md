---
kind: story
size: 3
status: open
blockedBy: ["3277"]
dateOpened: "2026-09-07"
tags: []
---

# A permanent decision-ledger Artifact, backed by the db capability, records ratified decisions durably

A published Artifact page that permanently records RATIFIED decisions -- which fork/option was chosen, who decided, when, why -- as durable db-capability documents (e.g. decisions/<id>/rulings/<id>), queryable later via read_db. Not a view of what is pending; a durable audit trail scratch files and chat history do not have. Distinct from we:backlog/3277-declare-an-operation-that-publishes-and-refreshes-a-decision.md (the publish/refresh operation, rendering-focused). Open fork: same artifact as the pending-decisions docket (two sections) vs. a separate page -- recommended default: same artifact, ruling in place beats context-switching.

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
  list) did not turn one up. **Flagging, not assuming:** either it was not actually filed, or it exists under
  wording this search missed. If/when it turns up, revisit the fork below with it named directly.
- `grep -rl "capabilities.*db\|claude.use(\"db\")"` across the repo: only we:backlog/204 (an unrelated
  capability-vocabulary matrix) and an unrelated agent-memory file matched. No existing use of the Artifact
  `db` capability in this repo. Confirmed genuinely new.

## Open fork -- flagged, not decided here

**Same artifact as the pending-decisions docket, two sections (ledger + docket) vs. two separate pages.**
Recommended default: **same artifact, two sections** -- ruling a decision right where its forks are already
being read beats a context-switch to a second page, and a single `db`-backed page can hold both a
`decisions/*` (pending, mirrors #3277's rendering) and `decisions/*/rulings/*` (ratified) collection without
conflict. Counter-consideration: the docket item (once found or filed) may already have committed to a
specific page shape that doesn't want a ledger section grafted on, or may want a different refresh cadence
than a ledger (rulings are append-only and rare; the docket's forks change more often). Ratify this once the
docket item is located or filed, before or during build -- do not guess silently.

## Scope (build-ready once the fork above is ratified)

- Declare `capabilities: {db: {}}` on the published page (per we:.claude/skills/artifact-capabilities).
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
