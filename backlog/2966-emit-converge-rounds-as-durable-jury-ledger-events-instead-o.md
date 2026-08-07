---
bornAs: x43il30
kind: story
size: 2
status: open
dateOpened: "2026-08-06"
tags: []
---

# Emit /converge rounds as durable jury-ledger events instead of a private temp trail

The extracted convergence core keeps its own history and dismissed trail inside an ad-hoc temp state file rather than emitting the repo's durable jury ledger events (JURY_EVENT_TYPES / we:scripts/lib/jury-ledger.mjs). So the conveyor's jury tree and the #2642 console show NOTHING for pre-PR convergence work, and the parked-PR migration under #2970 would inherit two parallel trails for one loop. Emit the same ledger events the parked-PR path already appends, keeping the in-state history as the pure core's own audit record.

## Where the seam is

The split is already right and should not move: the CORE stays pure (no I/O, no clock) and keeps building the
`history` / `dismissed` arrays as a total function of its arguments; the CLI owns every effect. So the emission
belongs in we:scripts/converge-cli.mjs, next to where it already writes the state envelope — one ledger append
per round transition, derived from the `history` entry the core just returned.

## Definition of done

- Every `/converge` round transition (panel, invite, edit, red-team, land, escalate) appends the corresponding
  `JURY_EVENT_TYPES` event through we:scripts/lib/jury-ledger.mjs.
- The event shape matches what we:scripts/workflows/review-parked-prs.mjs already appends, so the #2642 console
  renders a pre-PR run and a parked-PR run through ONE reader, not two.
- The core stays pure — no ledger import in we:scripts/lib/converge-core.mjs.
- A run with an unwritable ledger still completes and reports its verdict (the ledger is a trail, never a gate).

Found in the PR #1064 human review.
