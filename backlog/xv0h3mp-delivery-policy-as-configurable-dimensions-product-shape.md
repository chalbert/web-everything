---
kind: epic
parent: "4305"
status: open
dateOpened: "2026-09-28"
tags: []
---

# Delivery policy as configurable dimensions (product shape)

Full design: every process rule (prepare depth/MVP cut, review rounds + blocking classes, scope budget, test strategy, soak/replay, live-proof gate, draft ownership, capacity caps, model routing + probation, specialist roles #4361, postmortems, telemetry) becomes a named policy dimension, layered defaults -> org/project -> risk (care level) -> card, recorded per run so run rating compares policies. Constellation split: WE=standard (dimensions/schema/validator, no engine), Frontier UI=engine, Plateau=settings UI + /wip policy view. MVP cut: ONE policy file the daemons already read, consolidating today's scattered caps (WE_HEAVY_ADMISSION_CAP, WE_MAX_CONCURRENT_LANES, --max-concurrent, --max-open-items) and prepare/draft/test rules from briefs/doctrine -- no behavior change. Follow-up slices filed separately.

## Full design (product shape — no engine yet)

Every process rule this repo's mechanized delivery already leans on today — how deep to prepare before a
build, how many review rounds and which findings block, how big a scope budget a lane gets, whether tests run
local-only or wait on CI, whether a soak/replay pass is required, whether a live-proof gate applies, who owns
a draft PR, per-lane/per-host capacity caps, which model/provider a worker runs on and its probation state,
routing to a specialist role (#4361), whether a postmortem is owed, and what telemetry a run records — becomes
a **named policy dimension** with enumerated options, not a rule scattered across a plist, an env var, and a
doctrine doc. Dimensions layer: platform default → org/project override → risk tier (the existing care level)
→ per-card override. The policy actually chosen for a run is recorded on that run, so the run-rating report
(we:backlog/4304-run-rating-record-whether-an-item-was-prepared-dor-before-bu.md is the first instance of this
comparison, prepared-vs-not) can compare outcomes **by policy**, not just by whether a step happened. Later
(explicitly not this epic): suggestions synthesized from measured outcomes across policies — promotion to a
new default always stays a human call, never automatic.

**Constellation split**, per rule 6 (WE holds zero standard implementation) and the WE/FUI/Plateau boundary:
WE owns the **standard** — the dimension list, its options, the schema, and a validator — and no engine. Frontier
UI owns the **engine** that reads a resolved policy and enforces it. Plateau owns the **product surface** — a
settings UI per project, and `/wip` showing the policy in effect per item plus cross-item comparisons.

Cites the forthcoming agent-memory rule `process-rules-as-configurable-policy` (expected in a sibling PR, not
yet landed as of this filing) for the underlying rationale — configurable-dimension policy over ad-hoc rule
scatter — so this epic doesn't restate that argument from scratch.

## MVP cut (this epic's first slice — Musts only)

1. **Must** — ONE policy file becomes the single place the daemons read the caps and rules below from,
   replacing today's scattered sources: `WE_HEAVY_ADMISSION_CAP`, `WE_MAX_CONCURRENT_LANES`, `--max-concurrent`,
   `--max-open-items` (today: plist/env), plus the prepare/draft/test rules today living in briefs and
   doctrine docs.
2. **Must** — **no behavior change**: every consolidated value resolves to the exact effective value it
   resolves to today, provably (a before/after diff over a fixed sample of hosts/lanes shows zero deltas).
3. **Must** — every piece of the Full design above that this slice does NOT build — the schema/standard, the
   FUI engine, the Plateau settings UI + `/wip` view, the outcome-suggestion loop, specialist-role routing
   (#4361) — is filed as its own follow-up card, `blockedBy` this one wherever a real dependency exists, never
   silently dropped.
4. **Not MVP, not blocking** — everything in the Full design section beyond the one consolidated file: no
   schema, no validator, no engine, no settings UI, no suggestion loop. Those are real, but this epic doesn't
   wait on them.

**Review gate:** blocks only on a Must above being unmet, or genuine harm (a consolidated value that silently
diverges from today's effective behavior) — never on a Full-design item being deferred to a follow-up slice.

## Done when

This is a vision epic with no single executable acceptance check — same shape as its parent #4305 — so it
resolves the normal way, by every sliced child card resolving (rule: resolve-epic-by-parent-edges). First step
is slicing: the MVP consolidation slice (the one policy file, no-behavior-change), then the schema/standard
slice (WE), the engine slice (FUI), and the Plateau settings-UI slice, per the split-backlog-item method.
