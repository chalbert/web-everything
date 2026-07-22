---
bornAs: x5etmdv
kind: story
size: 3
parent: "2612"
status: open
dateOpened: "2026-07-22"
tags: [plateau-loop, conveyor, health, lane]
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
