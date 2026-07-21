---
bornAs: xz4k8mp
kind: story
size: 3
parent: "2555"
status: resolved
dateOpened: "2026-07-21"
dateResolved: "2026-07-21"
tags: [plateau-loop, console, console-board, scope-lease, lane-zones, slice-2555]
---

# Console board live lease-zone (breach + overlap section + policy control)

Carved from #2589 (which was a size-5 slice mixing several concerns): this is the piece actually SHIPPED — the
board's live scope-lease **zone**, the payoff of the #2560 engine. It renders the live conflict picture as a
below-board section, fed by the live collector.

## Scope (delivered)
- **Endpoint** `plateau-app:vite.config.mts` `scopeLease()` — `GET /api/scope-lease?repo=` execs the WE collector
  `we:scripts/readiness/scope-lease-collect.mjs --repo=<weRoot> --json` and streams the `liveScopePicture`; repo
  validated against the known-repo registry before argv; 12s timeout; 502 (with CORS) on failure.
- **Renderer** `plateau-app:src/backlog-view/lease-zone.ts` `renderLeaseZone(picture)` — a RED breach row per
  drifted lease (`octagon-alert`, UC-A4) + an AMBER overlap row per cross-lane scope overlap (glyph by outcome:
  `layers` UC-B2 for wait/ask, `fast-forward` UC-B3 for force). Repo prefixes stripped; all values HTML-escaped.
  Renders NOTHING when clean/undefined/empty (absence is the all-clear). Never green/teal per the §6 grammar.
- **`⚙` policy control** in the header surfacing the two #2560 knobs (overlap-at-launch, breach-mid-build), via a
  new `settings` sprite glyph.
- **Live wiring** `plateau-app:src/backlog-view/lane-board-data.ts` `BoardData.scopePicture` + a TOLERANT 3rd
  fetch (a scope-lease 502 yields `undefined`, never nulls the board); repainted on the existing 4s poll. The
  mount defaults `scope` to `undefined` (not the fixture) so a clean live board shows no phantom breach.

## Acceptance
The board fetches the live scope picture and renders breaches + overlaps + the policy control, on the poll;
a clean board shows no zone; a collect failure degrades to no-zone (never white-screens); sighted both themes;
`plateau-app` `backlog-view` suite green. Delivered across plateau PRs #85 + the cells/policy follow-up.

## Not here (see [remaining #2589])
Rendering the live breach/overlap as per-lane CELLS on the actual lane cards (not just the below-board section)
— that stays in #2589, blocked on a pool-lane ↔ board-card map. The original #2589's four-zone bands + overtake
affordance are dropped as SUPERSEDED by the shipped conveyor (#2586), spans (#2585), and lane cards.
