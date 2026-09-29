---
bornAs: xr7qn83
kind: story
size: 5
status: resolved
blockedBy: ["4470"]
scope: ["we:scripts/conveyor/tick-core.mjs", "we:skills-src/conveyor/prepare-item-agent-brief.md", "we:scripts/operations/dispatch-lane.mjs", "we:scripts/operations/dispatch-lane-io.mjs", "we:scripts/conveyor/session-slug.mjs", "we:scripts/readiness/dispatch-pause.mjs", "we:scripts/lib/dispatch-task-type.mjs", "we:scripts/check-standards-rules.mjs", "we:scripts/conveyor/__tests__/tick-core.test.mjs", "we:scripts/operations/__tests__/dispatch-lane.test.mjs", "we:scripts/operations/__tests__/dispatch-provider-registry.test.mjs"]
dateOpened: "2026-09-29"
dateStarted: "2026-09-29"
dateResolved: "2026-09-29"
preparedDate: "2026-09-29"
preparedAgainstSha: "b6f2a3ece4f1f901172d471fc8e0204fe53d6892"
tags: []
---

# Spawn a full prepare agent for needs-prepare holds (design/MVP/test/proof-plan authoring, not just scope)

Card #4470 adds a needs-prepare readiness hold (a scoped story/task with no truthful preparedDate is never dispatched to build) but its MVP cut deliberately stops at the gate — it does not spawn anything for a needs-prepare hold. This item builds that spawn: a new prepare-item agent brief that does the FULL prepare pass (premise check, scope correction, Design/MVP/Test-plan/Proof-plan authoring, prepare-stamp) for a generic story/task — distinct from the existing prepare-scope agent (spawnPrepareScope / we:prepare-scope-agent-brief.md), which only authors a missing scope field, a narrower mechanical edit. Wire it into we:tick-core.mjs's planPrepareSpawns (a new spawn list alongside scopeSpawns/decisionSpawns/investigationSpawns) and a new launch kind in we:dispatch-lane.mjs / we:dispatch-lane-io.mjs LAUNCH_KINDS, so a needs-prepare hold routes to this new agent the same tick-driven way unshaped-no-scope already routes to the scope-prepare agent. Done when: a needs-prepare item on a live tick spawns this agent (not a build), the agent's PR stamps preparedDate and lands via the normal PR path, and the item becomes build-eligible (dispatches normally) on a later tick.

## Done when

1. **Executable** — a live/fixture tick with a scoped, unprepared item held `needs-prepare` spawns this new
   prepare-item agent (a new entry in we:tick-core.mjs's `planPrepareSpawns`, not a build); before this item
   lands, that same tick spawns nothing for the hold (it just sits `needs-prepare` with no route out).
2. The spawned agent's own PR (a) writes `## Design` / `## MVP` / `## Test plan` / `## Proof plan` /
   `## Follow-ups` into the target item and (b) stamps `preparedDate` (via `we:scripts/backlog.mjs
   prepare-stamp` or the equivalent verb), and lands via the normal PR path.
3. On a LATER tick, the now-`preparedDate`-carrying item is build-eligible again and dispatches normally (no
   longer held `needs-prepare`) — proving the loop actually closes, not just that the agent ran once.

## Design

Add a fourth prepare-family spawn kind, `prepare-item`, for a scoped-but-unprepared story/task held
`needs-prepare` (#4470's own hold, in we:scripts/readiness/dispatch-plan.mjs around line 570). It mirrors the
existing `prepare`/`prepare-decision`/`investigate` kinds in `planPrepareSpawns`, inside
we:scripts/conveyor/tick-core.mjs, but derives its candidate set the same way `investigations` already is
(straight off `plan.held`, filtered `reason === 'needs-prepare'`, the same pattern used near line 1165 of
we:scripts/conveyor/tick-core.mjs) — #4470 already computes the hold with no separate `state` bucket, so no
upstream module needs new code. A new guard `kind:'prepare-item'` is retained by `retirePrepareGuards`, inside
we:scripts/conveyor/tick-core.mjs, against the WIDE held-set (same reasoning `investigate`'s guard already uses:
a transient reason-flip, e.g. `blocked`, must never retire the guard early while the agent is mid-run).

Bounded concurrency (operator: 1-2 concurrent). Unlike the other three prepare kinds, which are bounded only by
lane availability, `prepare-item` gets its own cap inside `planPrepareSpawns`: a new `maxConcurrentItemPrepares`
param (default 2), counted against already-live `prepare-item` guards (`livePrepareGuards` filtered by `kind`)
plus this tick's own new spawns, independent of how many lanes are free. This keeps the new agent kind
cheap/rare even when many lanes are idle — a held-back item over the cap gets a `prepare-item-cap` note, not
silence.

Wire the new kind through the `LAUNCH_KINDS` tables in we:scripts/operations/dispatch-lane.mjs and
we:scripts/operations/dispatch-lane-io.mjs exactly the way `prepare`/`prepare-decision` already are: no
self-adopt (`KIND_DECLARES_OCCUPANCY_ON_DISPATCH['prepare-item'] = false`), the same six item-scoped brief
placeholders (`ITEM_NUM`/`ITEM_SPEC_PATH`/`LANE`/`SESSION_SLUG`/`SCOPE`/`WE_ROOT`), routed to a new brief file.

Author a new file, we:skills-src/conveyor/prepare-item-agent-brief.md, inlining the operator's own "PREPARE
FIRST" method (premise check vs `main`, scope correction, `## Design`/`## MVP`/`## Test plan`/`## Proof
plan`/`## Follow-ups` authoring, `prepare-stamp`) in the same background-agent arc shape
we:skills-src/conveyor/prepare-decision-agent-brief.md already uses: acquire lane, `prepare-hold`, author,
`prepare-stamp`, gate, one adversarial review pass, PR (`label-on-green`), `prepare-release`, exit — never
build, never resolve (a prepared item is still `open`; the BUILD lifecycle picks it up on a later tick). The
decision-prepare brief delegates its authoring method to a dedicated skill; no equivalent skill documents the
story/task full-prepare method yet, so this new brief states the method itself (mirroring the decision brief's
structure) rather than delegate to one that doesn't exist.

## MVP

Musts only — build exactly this, nothing more:

1. we:scripts/conveyor/tick-core.mjs:
   - `needsPrepare` candidate derivation off `plan.held` (`reason === 'needs-prepare'`), same shape as the
     existing `investigations` derivation.
   - `itemPrepareSpawns` sink + `'prepare-item'` guard kind inside `planPrepareSpawns`, gated by the new
     `maxConcurrentItemPrepares` (default 2) concurrency cap, independent of lane availability.
   - `retirePrepareGuards` handles the new kind against a wide held-set (mirrors `investigate`).
   - Caller wiring: `launchedNums` grows with `itemPrepareSpawns`; `decisionsOut.spawnPrepareItems`; a new
     `auto-preparing-item` note (mirrors `auto-preparing-scope`); `'needs-prepare'` added to
     `HELD_NOTE_EXCLUDED_REASONS` (it now has its own dedicated note, like `needs-investigation`);
     `'prepare-item'` added to `TICK_SPAWN_KINDS` (so a kind-scoped dispatch-pause can hold it too).
2. we:scripts/operations/dispatch-lane.mjs and we:scripts/operations/dispatch-lane-io.mjs: add `'prepare-item'`
   to `LAUNCH_KINDS`, `BRIEF_REQUIRED_BY_KIND`, `KIND_DECLARES_OCCUPANCY_ON_DISPATCH` (`false`),
   `BRIEF_FILE_BY_LAUNCH_KIND_DISPLAY` / `BRIEF_BY_KIND` (routed to we:skills-src/conveyor/prepare-item-agent-brief.md),
   `LAUNCH_LISTS` (routed to `decisions.spawnPrepareItems`).
3. New file we:skills-src/conveyor/prepare-item-agent-brief.md (full prepare method + conveyor arc, per Design).
4. Tests extending we:scripts/conveyor/__tests__/tick-core.test.mjs and
   we:scripts/operations/__tests__/dispatch-lane.test.mjs per Test plan below.

Not in MVP (see Follow-ups): a standalone prepare-item skill the brief could delegate to instead of inlining
the method; an operator-configurable concurrency-cap knob; cosmetic JSDoc type-union updates elsewhere in the
two dispatch-lane files that enumerate "the six kinds" (now seven).

## Test plan

Each case must fail RED before the fix, for the stated reason:

- `planPrepareSpawns({ needsPrepare: [{num:99}], availableLanes:[5], tick:0 })` — before: no `itemPrepareSpawns`
  key exists on the return at all (the param is silently ignored). After: returns `itemPrepareSpawns:
  [{num:99, lane:5}]` plus a `newGuards` entry `{num:99, kind:'prepare-item', ...}`.
- A cap case: two `needsPrepare` candidates with `maxConcurrentItemPrepares:1` (or 1 live guard + 1 new
  candidate) — before: the param doesn't exist so nothing is capped (moot). After: only ONE spawns; the second
  surfaces a `prepare-item-cap` note, never a second `itemPrepareSpawns` entry.
- `retirePrepareGuards` with a `{num:5, kind:'prepare-item'}` guard and the item still present in the wide
  held-set — before: the ternary falls through to `unshapedNums`, which never contains the item (a
  needs-prepare item is never `unshaped`), so the guard retires `scope-committed` on tick 1, immediately
  under-suppressing a duplicate dispatch. After: the guard stays live until the item truly clears
  `needs-prepare`.
- A `planTick`-level fixture: `held: [{num:77, reason:'needs-prepare'}]`, item #77 scoped, no `preparedDate` —
  before: `decisions.spawnPrepareItems` is `undefined`/empty and `decisions.spawnBuilds` also excludes #77 — the
  card spawns nothing (the exact stuck-hold bug #4504 exists to fix). After: `decisions.spawnPrepareItems`
  contains `{num:77,...}`, `decisions.spawnBuilds` still excludes it.
- The kind-loop tests in we:scripts/operations/__tests__/dispatch-lane.test.mjs (brief-path resolution,
  `KIND_DECLARES_OCCUPANCY_ON_DISPATCH` key parity, the `['prepare','prepare-decision','fix','ci-heal']` loop)
  extended with `'prepare-item'` — before: `LAUNCH_KINDS` lacks it, so `briefPath(root,'prepare-item')` throws
  "no agent brief for kind". After: resolves to we:skills-src/conveyor/prepare-item-agent-brief.md.

## Proof plan

- Dry-run on the real queue: run the dispatch-plan report (we:scripts/readiness/dispatch-plan.mjs, or
  we:scripts/readiness/queue-report.mjs) against the live backlog to count N items currently held
  `needs-prepare`; then drive `planTick` (a small throwaway script, or the existing tick-core test harness)
  against that same live state — before the fix, 0 `prepare-item` dispatches are ever planned for those N holds
  (the kind doesn't exist); after, up to `maxConcurrentItemPrepares` are planned (capped), with the rest held
  with a `prepare-item-cap` note.
- One real prepare run on a scratch card: create a throwaway scratch backlog item (never merged, cleaned up
  after), scope it, leave it unprepared so the dispatch plan holds it `needs-prepare`; then run the same
  sequence the new brief instructs (`prepare-hold`, author `## Design`/`## MVP`/`## Test plan`/`## Proof
  plan`/`## Follow-ups`, `prepare-stamp`) by hand against it, and show (a) the item file now carries
  `preparedDate` plus all five sections, and (b) a re-run of the readiness check no longer holds it
  `needs-prepare` — proving the mechanism the brief drives is real, not just that the brief text reads well.
- Later-tick close: re-run the dry-run tick against the now-`preparedDate`-carrying scratch item and confirm it
  is build-eligible (selectable / would enter `plan.launch`), closing the loop end to end.

## Follow-ups

File as separate backlog items via the file-item operation, not built here:

- A standalone prepare-item (or generic "story/task full-prepare") skill the new brief could delegate to,
  mirroring how we:skills-src/conveyor/prepare-decision-agent-brief.md delegates its authoring method to a
  dedicated skill today, instead of inlining the method text directly in the conveyor brief.
- Make `maxConcurrentItemPrepares` an operator-configurable knob (env/config) instead of a hardcoded default.
- Cosmetic JSDoc type-union updates across we:scripts/operations/dispatch-lane.mjs and
  we:scripts/operations/dispatch-lane-io.mjs wherever prose still says "the six kinds" (now seven) — no
  behavior change, just comment hygiene.
- Any human-facing status-line/queue-report telemetry for the new kind beyond the one `auto-preparing-item`
  note, if a live run surfaces a real gap.
