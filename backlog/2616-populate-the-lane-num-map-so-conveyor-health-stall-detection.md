---
bornAs: x5etmdv
kind: story
size: 3
parent: "2612"
status: resolved
dateOpened: "2026-07-22"
dateStarted: "2026-07-26"
dateResolved: "2026-07-26"
tags: [plateau-loop, conveyor, health, lane]
scope:
  - we:scripts/lane-pool.mjs
  - we:scripts/backlog.mjs
  - we:scripts/readiness/
  - we:scripts/__tests__/
  - we:skills-src/conveyor/
---

# Populate the lane→num map so conveyor health-stall detection works

[we:scripts/readiness/conveyor-state.mjs](../scripts/readiness/conveyor-state.mjs) derives a lane's item
number from [we:.claude/lane-ports.json](../.claude/lane-ports.json) to run its stall scan, but that file is
`{}` and nothing in the lane acquire path populates it — so `state.health` is permanently `ok` and a stalled
lane is never surfaced. This item wires the map so a genuinely stalled lane can be flagged.

Today the `/conveyor` skill's in-flight dispatch-guard TTL is the only stall backstop: a spawned num that never
claims is dropped after N ticks. That catches a *never-claimed* num, not a lane that claimed its item and then
went silent. The health scan is meant to cover the second case, but it can't: it matches a lane to its item by
scraping `#<num>` from delivery-agent transcripts, and the lane→num lookup comes from `we:.claude/lane-ports.json`
(`{ "<num>": { lane } }`). That registry is empty, so no lane carries a num, the transcript scan is inert, and
`assessHealth` always returns `ok`.

The work: have the lane acquire path (or a small collector) write `{ "<num>": { lane } }` into
`we:.claude/lane-ports.json` when a delivery agent claims its item, so `conveyor-state`'s health scan and
`assessHealth` can flag a genuinely stalled lane (not just a never-claimed one).

Reference: the state-read script #2611 and the `/conveyor` skill #2613 both note this map is required; the
dispatch-guard TTL is the interim mitigation until it lands.

## Progress

- Added `--item=NNN[,NNN…]` to `we:scripts/lane-pool.mjs` acquire: it records the item→lane mapping into the
  PRIMARY checkout's `we:.claude/lane-ports.json` (the same registry #2139's `map` writes and
  `we:scripts/readiness/conveyor-state.mjs` reverse-derives lane→num from). Runs at acquire time in the primary
  checkout — where the main-session tick reads it — after the reset's `unmapLanes`, with its own pre-map unmap so
  lane→num stays 1:1 (covers the `--no-reset` path too). Band-less pools record `{ lane }` (no page port, all the
  health scan needs); the write is wrapped so a hiccup never fails the acquire, and rides stderr so acquire stdout
  stays the clean lane path.
- Factored the shared `registerItemsToLane` writer out of `cmdMap` (which keeps its port-required fail-loud);
  numeric ids normalize via `String(Number())`, JIT `x…` slugs lower-case (the `#num` transcript scan is
  case-sensitive).
- `we:scripts/readiness/conveyor-state.mjs`: extracted the pure `reverseLaneItemMap` (exported + unit-tested)
  from `laneItemMap`; refreshed the stale "registry is `{}` today / scan is INERT" comments to note acquire now
  populates it.
- `we:skills-src/conveyor/delivery-agent-brief.md`: the delivery-agent acquire call now passes `--item={{ITEM_NUM}}`.
- Tests: `we:scripts/__tests__/lane-pool-item-map.test.mjs` (real-CLI: primary-checkout write, banded-vs-band-less
  port, x-slug lower-case, reverse-derivation, back-compat no-write, 1:1 re-acquire, `--no-reset` replacement,
  multi-item) + `reverseLaneItemMap` unit tests in `we:scripts/readiness/__tests__/conveyor-state.test.mjs`. Gate
  green (check:standards, 0 errors).
