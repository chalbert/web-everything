---
kind: story
size: 5
parent: "3383"
status: open
scope: ["we:scripts/readiness/dispatch-plan.mjs", "we:scripts/conveyor/tick-core.mjs", "we:scripts/lib/lane-concurrency.mjs"]
dateOpened: "2026-09-07"
tags: []
---

# Cap concurrent dispatched lanes with a MAX_CONCURRENT_LANES admission ceiling

Live incident 2026-09-07: freeing one lane cascaded into 19 builds + 23 prepare-scope agents dispatching in ONE tick (42 concurrent claude -p sessions), driving 1-min load average to 34.95 on a 12-core/64GB host. Confirmed by reading we:scripts/readiness/dispatch-plan.mjs#dispatchPlan and we:scripts/conveyor/tick-core.mjs#planTick in full: neither has any concept of a global concurrent-lane ceiling — dispatchPlan assigns a launch to every free lane in rank order (bounded only by freeLanes.length), and planTick's planPrepareSpawns/planFixSpawns/planCiHealSpawns each independently consume whatever free lanes dispatchPlan's builds did not take, with zero shared budget across the four spawn kinds. This is a DIFFERENT layer from we:scripts/readiness/heavy-admission.mjs's existing cap=2 semaphore (#3461/#3456): that caps concurrent HEAVY COMMANDS (verify-lane/check:standards) running INSIDE already-dispatched lanes; this item caps how many lanes/claude-sessions get dispatched AT ALL, upstream of heavy-admission entirely — confirmed distinct by reading we:scripts/readiness/heavy-admission.mjs's own module header (it only gates the invocation of a named heavy-command set, never lane acquisition). Also distinct from, and does not require resolving, the staged hardware-usage-aware admission decision (xqraqab / we:backlog/xqraqab-how-far-to-take-heavy-command-admission-control-beyond-stage.md, filed but not yet merged in PR #1998) — that decision is specifically about whether heavy-admission's per-command cap should become EWMA-adaptive or learned; it says nothing about lane-dispatch concurrency, which today has no cap of any kind. Build a MAX_CONCURRENT_LANES ceiling: a small shared resolver (env var WE_MAX_CONCURRENT_LANES, mirroring we:scripts/readiness/heavy-admission.mjs's WE_HEAVY_ADMISSION_CAP config-knob convention, default conservative — well below tonight's 42-lane spike, e.g. 8 on this 12-core host) that (1) we:scripts/readiness/dispatch-plan.mjs#dispatchPlan trims its free-lane list against BEFORE assigning builds (using the currently-active leases count it already receives), holding the excess with a new, distinct HELD_REASONS entry (never conflated with the existing 'no free lane' reason, which means something structurally different: no free lane at all vs. free lanes existing but capacity-gated), and (2) we:scripts/conveyor/tick-core.mjs#planTick trims the availableLanes budget prepare/fix/ci-heal spawns draw from, by the SAME cap minus (already-active lanes + this tick's admitted builds), so the four spawn kinds combined can never exceed the ceiling in one tick. Not the full hardware-usage-aware/self-learning project xc1idt1 stages toward — this is the simple, fixed, conservative floor that is correct regardless of how that fuller decision eventually resolves.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.
