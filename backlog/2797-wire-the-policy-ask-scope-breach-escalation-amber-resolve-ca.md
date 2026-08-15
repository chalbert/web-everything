---
bornAs: xzjfj4u
kind: story
size: 5
parent: "2555"
status: open
locus: plateau-app
blockedBy: ["3114"]
dateOpened: "2026-07-31"
tags: [plateau-loop, console, console-board, scope-lease, canonical-2554]
scope:
  - plateau-app:src/backlog-view/card-taxonomy.webcases.ts
  - plateau-app:src/backlog-view/card-taxonomy.webcases.test.ts
  - plateau-app:src/backlog-view/card-taxonomy-docs.test.ts
  - plateau-app:src/backlog-view/card-state-read-model.ts
  - plateau-app:src/backlog-view/card-state-read-model.test.ts
  - plateau-app:src/backlog-view/lane-board-data.ts
  - plateau-app:src/backlog-view/lane-board-data.test.ts
  - plateau-app:src/backlog-view/operator-actions.ts
  - plateau-app:src/backlog-view/lane-board.test.ts
  - plateau-app:docs/backlog-console-design.md
---

# Wire the escalated (policy=park) scope-breach onto UC-A16, the amber Resolve card

Promote a scope-breached lane from A4's ratified agent-only default (§2574) to the new UC-A16 amber you-card
(minted by [#3114]) once its breach escalates under `breachMidBuild: 'park'` — the one policy branch
`we:scripts/readiness/scope-lease.mjs`'s `breachOutcome` already computes but the board's read-model doesn't
yet consume. Wiring only: the live policy/retry-count signal the original digest called a prerequisite is
**already shipped** (§2560/§2598/§2589, all `status: resolved`); this item is the remaining consumer-side map
from that live signal into the card the operator sees. The verb button itself needs no bespoke
"resolve-at-drain plumbing" — it rides the same generic, deliberately-unwired `we-button.lb-verb` affordance
every other you-act verb on the board already uses (`plateau-app:src/backlog-view/lane-board.ts:1660-1683`).
Deferred out of #2792 (chrome-consistency) because #2574 keeps agent-state the default; blocked on
[#3114] because the amber card's UC-id doesn't exist in the ratified taxonomy yet.

## Findings from verification against live code (2026-08-15)

1. **The stated prerequisite is already done.** The digest says this story "needs a live policy/retry-count
   signal in the scope-lease read-model first." That signal already exists end to end: the per-lane durable
   breach-attempt counter (`we:scripts/readiness/scope-lease-collect.mjs:177-231` `advanceBreachCount` +
   `:279-352` `collectSnapshot`'s `breachAttemptForLane` sidecar at `<laneDir>/.git/.lane-breach-count`,
   built by WE #2598, `status: resolved`), the pure policy engine
   (`we:scripts/readiness/scope-lease.mjs:326-358` `breachOutcome`, WE #2560, `status: resolved`), and the
   live projection into the wire shape the board fetches
   (`we:scripts/readiness/scope-lease-live.mjs:66-90` stamping the full `breachOutcome` result onto each
   lease's `outcome`, WE #2589, `status: resolved`) are all shipped. `plateau-app:src/backlog-view/types.ts:50-65`
   `ScopePicture.leases[].outcome` already carries it (typed as `{ action?, rung?, escalated?, [k]: unknown }`
   — a passthrough wide enough for `holdSource`/`routes`/`attempt`/`retryBound` too). Nothing on the WE side
   blocks this build.
2. **"policy=ask" is the wrong enum token — the escalating value is `'park'`.** `overlapAtLaunch` (the
   launch-time knob) has values `wait | ask | force` (`we:scripts/readiness/scope-lease.mjs:230`); the
   **breach**-mid-build knob (`breachMidBuild`, what A4 actually runs under) has values
   `pause | park | resolve-at-drain` (`we:scripts/readiness/scope-lease.mjs:276`) — `'ask'` is not a legal
   `breachMidBuild` value at all. `breachOutcome`'s `'park'` branch
   (`we:scripts/readiness/scope-lease.mjs:350-354`) is the one that "promote[s] to an amber you-card offering
   the route menu" — exactly the behavior this story wires. The design doc's own prose ("only policy = ask
   turns this into a you-card", `plateau-app:docs/backlog-console-design.md:295`) is loose paraphrase of
   §2574's ruling, not a literal token; the code is ground truth. This story targets `action === 'park'`.
3. **No UC-id exists for the promoted card — filed as [#3114].** The ratified taxonomy is hard-pinned at
   37 states / 17 you-act verbs across `plateau-app:src/backlog-view/card-state-read-model.test.ts:85`,
   `plateau-app:src/backlog-view/card-taxonomy.webcases.test.ts:69,111,278,323`, and
   `plateau-app:src/backlog-view/card-taxonomy-docs.test.ts:26,76,303` and
   `plateau-app:src/backlog-view/lane-board.test.ts:617`. §2574's own Fork 4 requires any count change to be
   "a separate decision that supersedes §6e with lineage — never an edit folded into A4's transition table"
   (`plateau-app:docs/backlog-console-design.md:311-313`). [#3114] is that decision (mints `UC-A16`); this
   story is `blockedBy` it and targets the UC-id it ratifies.
4. **The `'pause'` and `'resolve-at-drain'` branches need NO new card.** `breachOutcome`'s `'pause'` branch
   sets `holdSource: 'sibling-lane'` — a hand-off to the cross-lane family the board already renders (UC-B2
   overlap / UC-B3 forced / UC-B8 rival, via `plateau-app:src/backlog-view/lane-board-data.ts:247-265`
   `conflictsByNum`). The `'resolve-at-drain'` branch sets `resolveAtDrain: true` and keeps building —
   the card stays `UC-A3` until the drain resolves it. Only `'park'` is genuinely unrendered today; this
   story's scope is that one branch, not a general escalation-ladder UI.
5. **The verb needs no bespoke write plumbing.** Every `we-button.lb-verb` click on the board — including
   the existing amber verbs "Review PR" (A6), "Unhold merge" (A12), "Resolve conflict" (E2), "Choose route"
   (A13) — currently resolves to the SAME honest stub:
   `` `${verb} → #${id} (queued; the operable wiring lands in a later slice)` ``
   (`plateau-app:src/backlog-view/lane-board.ts:1680-1682`). "Resolve" on the new card is a `we-button.lb-verb`
   like the rest and inherits that same generic handler with zero new code — a bespoke "resolve-at-drain"
   write path would be inconsistent with every sibling verb and is explicitly future work (a separate,
   later slice), not this story's job.

## Decided design

- **Signal:** add a `escalatedBreach?: boolean` field to `CardConflict`
  (`plateau-app:src/backlog-view/lane-board-data.ts:47-54`), set in `conflictsByNum`
  (`plateau-app:src/backlog-view/lane-board-data.ts:248-265`) alongside the existing `breach` stamp: for a
  lease whose breach is active AND `lease.outcome?.action === 'park'` AND `lease.outcome?.escalated === true`,
  stamp `{ escalatedBreach: true }` on every `lease.items` num (in addition to the existing `{ breach: true }`
  — both fields co-exist; the read-model rule below ranks the escalated one first).
- **Read-model:** add `escalatedBreach?: boolean` to `CardSignals['build']`
  (`plateau-app:src/backlog-view/card-state-read-model.ts:86-101`, alongside `pausedReason`); set it in
  `overlayToSignals` (`plateau-app:src/backlog-view/lane-board-data.ts:94-99`) when `conflict.escalatedBreach
  && building`, mirroring the existing `pausedReason` branch. Add ONE new rule to `RULES`
  (`plateau-app:src/backlog-view/card-state-read-model.ts:176-239`) directly ABOVE the existing UC-A4 rule
  (line 205) — more specific wins first, per the file's own stated precedence convention (its header comment,
  lines 19–21): `{ uc: 'UC-A16', when: (s) => !!s.build?.escalatedBreach }`. `ACTOR_BY_UC` and `ALL_UC_IDS`
  need no code change — both are derived from the taxonomy webcases at module load
  (`plateau-app:src/backlog-view/card-state-read-model.ts:260-270`).
- **Taxonomy:** add ONE new WEB CASE to `CONSOLE_CARD_CASES['console-card-lifecycle']`
  (`plateau-app:src/backlog-view/card-taxonomy.webcases.ts`, alongside cases 1–15), carrying the grammar
  [#3114] ratifies (seed proposal: `assert: actor=you edge=amber primary=Resolve rendered=yes uc=UC-A16
  glyph=octagon-alert motion=shake verbGlyph=split`), title "escalated — scope breach", description citing
  the `breachMidBuild=park` cause and the escalation-ladder routes
  (`we:scripts/readiness/scope-lease.mjs:290-299` `BREACH_ESCALATION_LADDER`).
- **Drag-preview parity:** add `'UC-A16'` to `CONFLICT_UCS`
  (`plateau-app:src/backlog-view/operator-actions.ts:24`) — a lane holding the escalated card is a scope-lease
  conflict lane exactly like UC-A4/B2/B3, so a drag-to-queue preview over it should read amber too
  (`plateau-app:src/backlog-view/operator-actions.ts:37-41` `laneConflictClass`, and the DOM-fallback selector
  at `:62`).
- **Design doc:** extend the §6e "full 37-state manifest" prose
  (`plateau-app:docs/backlog-console-design.md:440-471`) to 38 states / 18 you-act verbs, recording UC-A16's
  glyph/motion/verb-glyph once [#3114] ratifies them.

## Interfaces touched

- `CardConflict` (`plateau-app:src/backlog-view/lane-board-data.ts:47-54`): `+ escalatedBreach?: boolean`.
- `CardSignals['build']` (`plateau-app:src/backlog-view/card-state-read-model.ts:86-101`):
  `+ escalatedBreach?: boolean`.
- `RULES` (`plateau-app:src/backlog-view/card-state-read-model.ts:176-239`): `+ 1` entry, ordered before A4.
- `CONSOLE_CARD_CASES['console-card-lifecycle']` (`plateau-app:src/backlog-view/card-taxonomy.webcases.ts`):
  `+ 1` webcase (A-family: 15 → 16; taxonomy total: 37 → 38).
- `CONFLICT_UCS` (`plateau-app:src/backlog-view/operator-actions.ts:24`): `+ 'UC-A16'`.
- No server/API shape change — `we:scripts/readiness/scope-lease-collect.mjs --json` and
  `plateau-app:vite.config.mts`'s `/api/scope-lease` middleware already emit the full `breachOutcome` object
  per lease; nothing new to fetch.

## Tasks

1. Confirm [#3114] is ratified; take its final `glyph`/`motion`/`verbGlyph` tokens (may differ from the
   seed proposal after the four-lens rating pass).
2. Add the UC-A16 webcase to `plateau-app:src/backlog-view/card-taxonomy.webcases.ts` with the ratified grammar.
3. Update the taxonomy-count conformance assertions (37→38, and the A-family count 15→16 where asserted
   separately) at `plateau-app:src/backlog-view/card-state-read-model.test.ts:85`,
   `plateau-app:src/backlog-view/card-taxonomy.webcases.test.ts:69,111,278,323`,
   `plateau-app:src/backlog-view/card-taxonomy-docs.test.ts:26,76,303`,
   `plateau-app:src/backlog-view/lane-board.test.ts:617` — plus the new S6E row (that test file's `S6E`
   table) for UC-A16.
4. Add `escalatedBreach` to `CardConflict` and stamp it in `conflictsByNum`.
5. Add `escalatedBreach` to `CardSignals['build']`, set it in `overlayToSignals`, add the UC-A16 `RULES`
   entry above UC-A4.
6. Add `'UC-A16'` to `plateau-app:src/backlog-view/operator-actions.ts`'s `CONFLICT_UCS`.
7. Extend the design doc's §6e manifest prose to 38/18.
8. Unit tests: `plateau-app:src/backlog-view/lane-board-data.test.ts` (a lease with
   `outcome.action==='park', escalated:true` → the item's conflict carries `escalatedBreach`, and a building
   card maps to `UC-A16` not `UC-A4`); `plateau-app:src/backlog-view/card-state-read-model.test.ts` (the new
   rule fires above A4 when both `pausedReason` and `escalatedBreach` are set — the precedence case);
   `plateau-app:src/backlog-view/operator-actions.test.ts` if it asserts `CONFLICT_UCS` membership.

## Done when

- [ ] [#3114] is ratified (a prerequisite gate, not this story's own work).
- [ ] A `ScopePicture` fixture with one lease whose `outcome = { action: 'park', escalated: true, ... }`
      and a `building` card owning that lease renders as `UC-A16`, not `UC-A4` — proven by a unit test on
      `overlayToSignals`/`deriveCardState` (fixtures/injected data; a live demo is not required — the dev
      `/api/scope-lease` middleware never passes `--plan`, so breach detection is inert on today's live board
      per `we:scripts/readiness/scope-lease-collect.mjs:20-33`).
- [ ] The same fixture WITHOUT escalation (`attempt <= retryBound`, or `action !== 'park'`) still renders
      `UC-A4` unchanged — a regression guard proving the new rule doesn't widen past its trigger.
- [ ] `ALL_UC_IDS.length === 38` and every taxonomy-count assertion listed under Tasks #3 is updated and green.
- [ ] Clicking the new card's "Resolve" verb button produces the same honest
      `Resolve → #<id> (queued; the operable wiring lands in a later slice)` status text every other you-act
      verb produces — no bespoke write path added.
- [ ] A lane holding a `UC-A16` card previews amber (`oa-lane--conflict`) on a ready-card drag-over, same as
      A4/B2/B3 today.
- [ ] `plateau-app` `npm test` and `we:` `npm run check:standards` both pass. Both themes (the card composes
      the existing `card-single-box` anatomy, WE #2789 — no new box shape, so no new theme surface).

## Delivery shape

Two items, in order: [#3114] (the taxonomy-extension decision) must ratify before this story's PR opens —
its ruling fixes the UC-id and grammar tokens this story's diff needs to cite verbatim. Once ratified, this
story lands as ONE incremental PR behind `main` (no flag needed): the new rule sits strictly ABOVE UC-A4 in
precedence and only fires on a new signal (`escalatedBreach`) nothing currently sets, so it is inert until
`conflictsByNum` starts stamping it in the same commit — no partial-landed state is user-visible.
